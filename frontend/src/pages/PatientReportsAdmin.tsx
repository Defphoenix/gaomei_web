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
  patient_no: string;
  patient_name: string;
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

const STATUS_LABEL: Record<string, string> = {
  draft: "分析中",
  review: "待审核",
  released: "已发布",
  void: "已作废",
};

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

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.get("/v1/me/reports/")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch((err) => setError(err.response?.data?.detail || "加载报告列表失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.patient_no} ${row.patient_name} ${row.sample_id} ${row.report_number} ${row.title} ${row.product_code} ${row.wes_report_id || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

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
    // Always prefer WES HTML→PDF endpoint (wes_auth + write_pdf), never asset static file first.
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
            <p>V2 台账 · HTML 预览 / 编辑 / PDF · {user?.username || "内部用户"}</p>
          </div>
          <div className="portal-top-actions">
            <button type="button" className="button button-outline" onClick={load}>刷新</button>
            <a className="button button-primary" href="http://127.0.0.1:8001/admin/reports/report/" target="_blank" rel="noreferrer">
              Django Admin
            </a>
          </div>
        </header>

        <section className="portal-content">
          <div className="portal-panel">
            <div className="panel-head">
              <div>
                <h2>报告台账</h2>
                <p>HTML / 编辑 / PDF 走 WES 报告引擎；3D 报告与 IGV 走门户页</p>
              </div>
              <div className="project-search">
                <i className="fas fa-search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索患者编号 / 姓名 / 样本 / 报告号"
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
                      <th>患者</th>
                      <th>报告编号</th>
                      <th>样本 / WES</th>
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
                      return (
                        <tr key={row.id}>
                          <td>
                            <b>{row.patient_no || "—"}</b>
                            <small>{row.patient_name || "—"}</small>
                          </td>
                          <td>
                            <b>{row.report_number}</b>
                            <small>{row.title || "—"}</small>
                          </td>
                          <td>
                            <span>{row.sample_id || "—"}</span>
                            <small>{row.wes_report_id || "未绑定 WES JSON"}</small>
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
                                title={preview || "暂无 HTML 预览（需 analysis_data.wes_report_id 或样本 JSON）"}
                                onClick={() => openWes(preview)}
                              >
                                <i className="fas fa-eye" /> HTML
                              </button>
                              <button
                                type="button"
                                className="button button-small button-outline"
                                disabled={!edit}
                                title={edit || "暂无编辑页"}
                                onClick={() => openWes(edit)}
                              >
                                <i className="fas fa-edit" /> 编辑
                              </button>
                              <button
                                type="button"
                                className="button button-small button-outline"
                                disabled={!pdfReady && !row.download_url}
                                title={pdfReady || row.download_url ? "下载正式 PDF" : "PDF 尚未生成"}
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
                        <td colSpan={7}>
                          <div className="empty-state">
                            暂无报告。请用 Django Admin 新建患者/报告，或 API Key 调用 /api/v1/ingest/reports/ 导入。
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
    </div>
  );
};

export default PatientReportsAdmin;
