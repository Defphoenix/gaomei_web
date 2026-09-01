import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import PortalSidebar from "../components/PortalSidebar";

type PatientSlot = {
  patient_no: string;
  patient_name: string;
  sample_id: string;
  wes_report_id: string;
  upload_id: string;
  bundle_status: string;
  pdf_ready: boolean;
  pdf_error: string;
  report_id: number | null;
  report_status: string;
  updated_at: string;
  preview_url: string;
  edit_url: string;
  portal_report_url?: string;
  portal_igv_url?: string;
  download_url: string;
  file_count: number;
  bundle_count: number;
};

function openWes(path: string) {
  if (!path) return;
  const token = localStorage.getItem("access_token") || "";
  const url = token ? `${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}` : path;
  window.open(url, "_blank", "noopener,noreferrer");
}

function wesPreviewUrl(row: PatientSlot) {
  return row.preview_url || (row.wes_report_id ? `/wes/reports/${row.wes_report_id}/` : "");
}

function wesEditUrl(row: PatientSlot) {
  return row.edit_url || (row.wes_report_id ? `/wes/reports/${row.wes_report_id}/edit/` : "");
}

const PatientReportsAdmin: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<PatientSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.get("/reports/patient-slots/")
      .then((res) => setRows(res.data))
      .catch((err) => setError(err.response?.data?.detail || "加载患者报告台账失败"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      `${row.patient_no} ${row.patient_name} ${row.sample_id} ${row.upload_id}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function downloadPdf(row: PatientSlot) {
    if (!row.report_id) return;
    try {
      const response = await api.get(`/reports/${row.report_id}/pdf/`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${row.sample_id || row.patient_no}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert("PDF 下载失败（可能尚未生成或未发布权限）");
    }
  }

  return (
    <div className="portal-page">
      <PortalSidebar />

      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <h1>患者报告</h1>
            <p>按患者编号管理 · {user?.username || "内部用户"}</p>
          </div>
          <div className="portal-top-actions">
            <button type="button" className="button button-outline" onClick={load}>刷新</button>
          </div>
        </header>

        <section className="portal-content">
          <div className="portal-panel">
            <div className="panel-head">
              <div>
                <h2>患者编号台账</h2>
                <p>HTML / PDF / 3D 互动报告 / IGV 同一份 current.json 数据</p>
              </div>
              <div className="project-search">
                <i className="fas fa-search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索患者编号 / 姓名 / 样本"
                />
              </div>
            </div>
            {error && <div className="cloud-create-error">{error}</div>}
            <div className="table-wrap">
              <table className="project-table">
                <thead>
                  <tr>
                    <th>患者编号</th>
                    <th>当前样本</th>
                    <th>上传版本</th>
                    <th>状态</th>
                    <th>PDF</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.patient_no}>
                      <td>
                        <b>{row.patient_no}</b>
                        <small>{row.patient_name || "—"}</small>
                      </td>
                      <td>{row.sample_id || "—"}</td>
                      <td>
                        <span className={`status-pill ${row.bundle_status === "active" ? "green" : "orange"}`}>
                          {row.upload_id || "尚未上传"}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill ${row.report_status === "released" ? "green" : "blue"}`}>
                          {row.report_status || "—"}
                        </span>
                      </td>
                      <td>
                        {row.pdf_ready ? (
                          <span className="status-pill green">已生成</span>
                        ) : (
                          <span className="status-pill orange" title={row.pdf_error || ""}>
                            {row.pdf_error ? "生成失败" : "待生成"}
                          </span>
                        )}
                      </td>
                      <td>{row.updated_at ? new Date(row.updated_at).toLocaleString("zh-CN") : "—"}</td>
                      <td>
                        <div className="row-actions report-slot-actions">
                          {row.report_id ? (
                            <Link
                              className="button button-small button-primary"
                              to={row.portal_report_url || `/reports/${row.report_id}`}
                              title="打开带 3D 模型的互动报告页"
                            >
                              <i className="fas fa-cube" /> 3D报告
                            </Link>
                          ) : (
                            <button type="button" className="button button-small" disabled>3D报告</button>
                          )}
                          {row.report_id ? (
                            <Link
                              className="button button-small button-outline"
                              to={row.portal_igv_url || `/browser?report=${row.report_id}`}
                            >
                              <i className="fas fa-dna" /> IGV
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            className="button button-small button-outline"
                            disabled={!wesPreviewUrl(row)}
                            title={wesPreviewUrl(row) || "暂无 HTML 预览"}
                            onClick={() => openWes(wesPreviewUrl(row))}
                          >
                            <i className="fas fa-eye" /> HTML
                          </button>
                          <button
                            type="button"
                            className="button button-small button-outline"
                            disabled={!wesEditUrl(row)}
                            title={wesEditUrl(row) || "暂无编辑页"}
                            onClick={() => openWes(wesEditUrl(row))}
                          >
                            <i className="fas fa-edit" /> 编辑
                          </button>
                          <button
                            type="button"
                            className="button button-small button-outline"
                            disabled={!row.download_url || !row.pdf_ready}
                            onClick={() => downloadPdf(row)}
                          >
                            <i className="fas fa-file-pdf" /> PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !filtered.length && (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">暂无患者报告包。等待 node9 调用 /api/bridge/reports/package/</div>
                      </td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={7}><div className="empty-state">加载中…</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default PatientReportsAdmin;
