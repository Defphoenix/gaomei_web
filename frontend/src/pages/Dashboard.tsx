import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import type { Report } from "../types";
import PortalSidebar from "../components/PortalSidebar";

type PortalRole = "admin" | "analyst" | "reviewer" | "client";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolePreview, setRolePreview] = useState<PortalRole | null>(null);

  useEffect(() => {
    api.get("/reports/").then((res) => setReports(res.data)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  const actualRole: PortalRole = user?.role === "customer" ? "client" : (user?.role as PortalRole) || (user?.is_staff ? "admin" : user?.is_bioinfo ? "analyst" : "client");
  const role = rolePreview || actualRole;
  const roleLabel = { admin: "管理员", analyst: "生信分析员", reviewer: "审核员", client: "客户" }[role];
  const canOperate = role === "admin" || role === "analyst" || role === "reviewer";

  return (
    <div className="portal-page">
      <PortalSidebar />

      <main className="portal-main">
        <header className="portal-topbar">
          <div><h1>上午好，{user?.username || "Gomics 用户"}</h1><p>{roleLabel}工作台</p></div>
          <div className="portal-top-actions">
            {user?.is_staff && <select value={role} onChange={(e) => setRolePreview(e.target.value as PortalRole)} aria-label="预览角色"><option value="admin">管理员视图</option><option value="analyst">分析员视图</option><option value="reviewer">审核员视图</option><option value="client">客户视图</option></select>}
            <button aria-label="通知"><i className="fas fa-bell" /><b>3</b></button><div className="portal-avatar">{(user?.username || "G").slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <section className="portal-content" id="overview">
          <div className="portal-welcome">
            <div>
              <span className="eyebrow">CLINICAL GENOMICS WORKSPACE</span>
              <h2>{role === "client" ? "您的检测进度与报告" : "患者报告与审核工作台"}</h2>
              <p>{role === "client" ? "查看已发布报告与变异证据。" : "管理患者报告包，预览 HTML、编辑并审核发布。"}</p>
            </div>
            {canOperate && <Link className="button button-primary" to="/patient-reports"><i className="fas fa-file-medical" /> 打开患者报告</Link>}
          </div>

          <div className="metric-grid">
            {[
              ["报告总数", `${reports.length}`, "fa-file-medical", "soft-purple"],
              ["待审核", `${reports.filter((r) => r.status === "review").length}`, "fa-clipboard-check", "soft-orange"],
              ["已发布", `${reports.filter((r) => r.status === "released").length}`, "fa-check-circle", "soft-green"],
              ["工作角色", roleLabel, "fa-user-shield", "soft-blue"],
            ].map(([label, value, icon, tone]) => (
              <article className={`metric-card ${tone}`} key={label}>
                <div><span>{label}</span><strong>{loading && label === "报告总数" ? "…" : value}</strong></div>
                <i className={`fas ${icon}`} />
              </article>
            ))}
          </div>

          <div className="portal-lower-grid">
            <section className="portal-panel" id="analysis">
              <div className="panel-head">
                <div>
                  <h2>最近报告</h2>
                  <p>{role === "client" ? "已发布报告列表" : "门户可见报告（含待审核）"}</p>
                </div>
                {canOperate ? <Link to="/patient-reports">患者报告</Link> : <Link to="/browser">查看 IGV</Link>}
              </div>
              {reports.length ? (
                <div className="activity-list">
                  {reports.slice(0, 5).map((report) => (
                    <div key={report.id}>
                      <span className={`activity-icon ${report.status === "released" ? "green" : "orange"}`}><i className="fas fa-circle" /></span>
                      <div>
                        <b>{report.title}</b>
                        <small>{report.report_number || report.sample_id} · {report.status}</small>
                      </div>
                      <Link className="button button-small button-outline" to={`/reports/${report.id}`}>查看</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">{role === "client" ? "尚无已发布报告" : "暂无报告"}</div>
              )}
            </section>
            <section className="portal-panel" id="review">
              <div className="panel-head">
                <div>
                  <h2>{role === "client" ? "访问提示" : "审核发布"}</h2>
                  <p>{role === "client" ? "报告发布后可在个人报告中心下载 PDF" : "在患者报告页编辑排版，确认后发布给患者"}</p>
                </div>
              </div>
              {canOperate ? (
                <div className="empty-state">
                  请前往 <Link to="/patient-reports">患者报告</Link> 查看 HTML / 编辑 / 确认 PDF。
                </div>
              ) : (
                <div className="empty-state">登录后可在「个人报告」下载正式 PDF。</div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
