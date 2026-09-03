import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { downloadAuthenticatedPdf } from "../api/downloadPdf";
import { useAuth } from "../context/AuthContext";
import PortalSidebar from "../components/PortalSidebar";

type ReportRow = {
  id: number;
  report_number: string;
  title: string;
  product_code: string;
  report_type: string;
  sample_id: string;
  status: string;
  report_date: string | null;
  released_at: string | null;
  patient_id: number;
  patient_no: string;
  patient_name: string;
  patient_username?: string;
  pdf_available: boolean;
  pdf_ready?: boolean;
  wes_report_id?: string;
  preview_url?: string;
  edit_url?: string;
  download_url?: string;
  report_pdf_url?: string;
  report_pdf_download_url?: string;
  portal_report_url?: string;
  genome_build?: string;
};

type PatientOption = { patient_no: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  draft: "分析中",
  review: "待审核",
  released: "已发布",
  void: "已作废",
};

const PRODUCT_LABEL: Record<string, string> = {
  WES_TN: "WES 肿瘤-正常",
  GENE_PANEL: "靶向基因 Panel",
  LUNG_PANEL: "肺癌 Panel",
};

function productLabel(code?: string) {
  const raw = String(code || "").trim();
  if (!raw) return "未指定";
  return PRODUCT_LABEL[raw] || PRODUCT_LABEL[raw.toUpperCase()] || raw;
}

function openWes(path: string) {
  if (!path) return;
  const token = localStorage.getItem("access_token") || "";
  const url = token ? `${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}` : path;
  window.open(url, "_blank", "noopener,noreferrer");
}

const PatientReportsAdmin: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [releasing, setReleasing] = useState<number | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState<number | null>(null);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [gmRow, setGmRow] = useState<ReportRow | null>(null);
  const [gmPatientNo, setGmPatientNo] = useState("");
  const [gmSaving, setGmSaving] = useState(false);

  const isAdmin = user?.role === "admin" || !!user?.is_staff;

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.get("/v1/me/reports/")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || "加载报告列表失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/v1/db-browser/patients/")
      .then((res) => {
        const list = (Array.isArray(res.data) ? res.data : []).map((p: Record<string, unknown>) => ({
          patient_no: String(p.patient_no || ""),
          name: String(p.name || ""),
        })).filter((p: PatientOption) => p.patient_no);
        setPatients(list);
      })
      .catch(() => setPatients([]));
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.id} ${row.patient_no} ${row.patient_name} ${row.sample_id} ${row.report_number} ${row.title} ${row.product_code} ${row.wes_report_id || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  function openGmBind(row: ReportRow) {
    setGmRow(row);
    setGmPatientNo(row.patient_no || "");
  }

  async function saveGmBind() {
    if (!gmRow?.id || !gmPatientNo) return;
    setGmSaving(true);
    try {
      await api.patch(`/v1/db-browser/reports/${gmRow.id}/`, {
        patient_no: gmPatientNo,
      });
      setGmRow(null);
      await load();
    } catch (err: any) {
      window.alert(err.response?.data?.detail || "归属患者更新失败");
    } finally {
      setGmSaving(false);
    }
  }

  async function releaseReport(id: number) {
    if (!window.confirm("确认发布该报告？发布后客户可见，且导入流水线默认不可再改内容。")) return;
    setReleasing(id);
    try {
      await api.post(`/v1/reports/${id}/release/`);
      await load();
    } catch (err: any) {
      window.alert(err.response?.data?.detail || "发布失败");
    } finally {
      setReleasing(null);
    }
  }

  async function submitReview(id: number) {
    setWorkflowBusy(id);
    try {
      await api.post(`/v1/reports/${id}/submit-review/`);
      await load();
    } catch (err: any) {
      window.alert(err.response?.data?.detail || "送审失败");
    } finally {
      setWorkflowBusy(null);
    }
  }

  async function voidReport(id: number) {
    if (!window.confirm("确认作废该报告？客户将不可见。")) return;
    setWorkflowBusy(id);
    try {
      await api.post(`/v1/reports/${id}/void/`);
      await load();
    } catch (err: any) {
      window.alert(err.response?.data?.detail || "作废失败");
    } finally {
      setWorkflowBusy(null);
    }
  }

  async function downloadPdf(row: ReportRow) {
    const wesId = row.wes_report_id || "";
    const url =
      (wesId ? `/wes/reports/${wesId}/pdf/` : "")
      || (row.download_url?.startsWith("/wes/") ? row.download_url : "")
      || row.download_url
      || row.report_pdf_download_url
      || "";
    if (!url) {
      window.alert("PDF 不可用：请先绑定 WES JSON（analysis_data.wes_report_id）");
      return;
    }
    try {
      await downloadAuthenticatedPdf(
        url,
        `${row.wes_report_id || row.sample_id || row.report_number || "report"}.pdf`,
      );
    } catch (err: any) {
      window.alert(err?.message || "PDF 下载失败（可能被鉴权拦截或 HTML→PDF 生成失败）");
    }
  }

  const canRelease = user?.role === "admin" || user?.role === "reviewer" || !!user?.is_staff;
  const canSubmitReview = canRelease || user?.role === "analyst";
  const canVoid = canRelease;

  return (
    <div className="portal-page">
      <PortalSidebar />
      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <h1>患者报告</h1>
            <p>
              每份报告有独立编号 GM-R；归属患者编号 GM-P（一患者可多报告）。
              登录账号请在「用户与权限」绑定 GM-P。
            </p>
          </div>
          <div className="portal-top-actions">
            <button type="button" className="button button-outline" onClick={load}>刷新</button>
            {isAdmin ? (
              <Link className="button button-outline" to="/db-browser?table=users">用户与权限</Link>
            ) : null}
          </div>
        </header>

        <section className="portal-content">
          <div className="portal-panel">
            <div className="panel-head">
              <div>
                <h2>报告台账</h2>
                <p>按报告 ID / GM-R 管理；「归属 GM」只改患者编号，不绑登录账号</p>
              </div>
              <div className="project-search">
                <i className="fas fa-search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索报告ID / GM-R / GM-P / 样本 / 姓名"
                />
              </div>
            </div>
            {error && <div className="cloud-create-error">{error}</div>}
            {loading ? (
              <div className="empty-state">加载中…</div>
            ) : (
              <div className="table-wrap">
                <table className="project-table">
                  <thead>
                    <tr>
                      <th>报告 ID</th>
                      <th>报告编号</th>
                      <th>归属 GM</th>
                      <th>产品</th>
                      <th>样本 / data</th>
                      <th>状态</th>
                      <th>PDF</th>
                      <th>日期</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const preview = row.preview_url || (row.wes_report_id ? `/wes/reports/${row.wes_report_id}/` : "");
                      const edit = row.edit_url || (row.wes_report_id ? `/wes/reports/${row.wes_report_id}/edit/` : "");
                      const pdfReady = !!(row.pdf_ready || row.pdf_available);
                      const dataLabel = row.sample_id || `data/${row.id}`;
                      const dataPath = `/db-browser?table=assets&report_id=${row.id}`;
                      return (
                        <tr key={row.id}>
                          <td>
                            <b>#{row.id}</b>
                          </td>
                          <td>
                            <b>{row.report_number}</b>
                          </td>
                          <td>
                            <div className="bind-cell">
                              <b>{row.patient_no || "—"}</b>
                              <small>{row.patient_name || "—"}</small>
                              {isAdmin ? (
                                <button type="button" className="button button-small button-outline" onClick={() => openGmBind(row)}>
                                  归属 GM
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>{productLabel(row.product_code)}</td>
                          <td>
                            {isAdmin ? (
                              <Link className="admin-folder-path" to={dataPath} title={`打开 data/${row.id}`}>
                                {dataLabel}
                              </Link>
                            ) : (
                              <span>{dataLabel}</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-pill ${row.status === "released" ? "green" : row.status === "review" ? "orange" : "blue"}`}>
                              {STATUS_LABEL[row.status] || row.status}
                            </span>
                          </td>
                          <td>
                            {pdfReady ? (
                              <span className="status-pill green">可下载</span>
                            ) : (
                              <span className="status-pill orange">待生成</span>
                            )}
                          </td>
                          <td>{row.report_date || "—"}</td>
                          <td>
                            <div className="row-actions report-slot-actions">
                              <Link className="button button-small button-primary" to={`/reports/${row.id}`}>
                                <i className="fas fa-cube" /> 3D报告
                              </Link>
                              <Link className="button button-small button-outline" to={`/browser?report=${row.id}`}>
                                <i className="fas fa-dna" /> IGV
                              </Link>
                              <button
                                type="button"
                                className="button button-small button-outline"
                                disabled={!preview}
                                title={preview || "暂无 HTML 预览"}
                                onClick={() => openWes(preview)}
                              >
                                <i className="fas fa-eye" /> HTML
                              </button>
                              <button
                                type="button"
                                className="button button-small button-outline"
                                disabled={!edit}
                                onClick={() => openWes(edit)}
                              >
                                <i className="fas fa-edit" /> 编辑
                              </button>
                              <button
                                type="button"
                                className="button button-small button-outline"
                                disabled={!pdfReady && !row.download_url}
                                onClick={() => { void downloadPdf(row); }}
                              >
                                <i className="fas fa-file-pdf" /> PDF
                              </button>
                              {canSubmitReview && row.status === "draft" ? (
                                <button
                                  type="button"
                                  className="button button-small button-outline"
                                  disabled={workflowBusy === row.id}
                                  onClick={() => { void submitReview(row.id); }}
                                >
                                  送审
                                </button>
                              ) : null}
                              {canRelease && row.status !== "released" && row.status !== "void" ? (
                                <button
                                  type="button"
                                  className="button button-small button-outline"
                                  disabled={releasing === row.id}
                                  onClick={() => { void releaseReport(row.id); }}
                                >
                                  {releasing === row.id ? "发布中…" : "发布"}
                                </button>
                              ) : null}
                              {canVoid && row.status !== "void" ? (
                                <button
                                  type="button"
                                  className="button button-small button-outline"
                                  disabled={workflowBusy === row.id}
                                  onClick={() => { void voidReport(row.id); }}
                                >
                                  作废
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state">
                            暂无报告。上传时带 patient_no（GM-P）、sample_id 与可选 product_code；系统自动分配独立报告编号 GM-R。
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {gmRow && (
        <div className="bind-modal-backdrop" role="presentation" onClick={() => setGmRow(null)}>
          <div className="bind-modal" role="dialog" aria-labelledby="gm-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="gm-title">归属 GM 编号</h3>
            <p>
              报告 <b>#{gmRow.id}</b>（{gmRow.report_number}）归属于哪个患者编号。
              同一 GM-P 可挂多份 GM-R；登录账号请到「用户与权限」绑定 GM-P。
            </p>
            <label>
              患者编号（GM-P）
              <select value={gmPatientNo} onChange={(e) => setGmPatientNo(e.target.value)}>
                <option value="">请选择</option>
                {patients.map((p) => (
                  <option key={p.patient_no} value={p.patient_no}>
                    {p.patient_no} · {p.name || "未命名"}
                  </option>
                ))}
                {gmPatientNo && !patients.some((p) => p.patient_no === gmPatientNo) ? (
                  <option value={gmPatientNo}>{gmPatientNo}（当前）</option>
                ) : null}
              </select>
            </label>
            <div className="bind-modal-actions">
              <button type="button" className="button button-outline" onClick={() => setGmRow(null)}>取消</button>
              <button
                type="button"
                className="button button-primary"
                disabled={gmSaving || !gmPatientNo}
                onClick={() => { void saveGmBind(); }}
              >
                {gmSaving ? "保存中…" : "保存归属"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientReportsAdmin;
