import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";
import type { Report } from "../types";
import PortalSidebar from "../components/PortalSidebar";

type PortalRole = "admin" | "analyst" | "reviewer" | "client";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgNew, setMsgNew] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get("/v1/me/reports/")
      .then((res) => setReports(Array.isArray(res.data) ? res.data : []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    api.get("/company/messages/stats/")
      .then((res) => setMsgNew(Number(res.data?.new || 0)))
      .catch(() => setMsgNew(0));
  }, []);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!bellRef.current?.contains(ev.target as Node)) setBellOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const role: PortalRole = user?.role === "customer"
    ? "client"
    : (user?.role as PortalRole) || (user?.is_staff ? "admin" : user?.is_bioinfo ? "analyst" : "client");
  const roleLabel = { admin: "管理员", analyst: "生信分析员", reviewer: "审核员", client: "客户" }[role];
  const canOperate = role === "admin" || role === "analyst" || role === "reviewer";
  const reviewCount = reports.filter((r) => r.status === "review").length;
  const bellTotal = msgNew + reviewCount;

  return (
    <div className="portal-page">
      <PortalSidebar />

      <main className="portal-main">
        <header className="portal-topbar">
          <div>
            <h1>上午好，{user?.username || "Gomics 用户"}</h1>
            <p>{roleLabel}工作台</p>
          </div>
          <div className="portal-top-actions">
            {canOperate && (
              <div className="portal-bell" ref={bellRef}>
                <button
                  type="button"
                  aria-label="通知"
                  aria-expanded={bellOpen}
                  onClick={() => setBellOpen((v) => !v)}
                >
                  <i className="fas fa-bell" />
                  {bellTotal > 0 ? <b>{bellTotal > 99 ? "99+" : bellTotal}</b> : null}
                </button>
                {bellOpen && (
                  <div className="portal-bell-menu">
                    <div className="portal-bell-head">通知</div>
                    <button
                      type="button"
                      className="portal-bell-item"
                      onClick={() => { setBellOpen(false); navigate("/contact-messages"); }}
                    >
                      <span>官网留言</span>
                      <em>{msgNew}</em>
                    </button>
                    <button
                      type="button"
                      className="portal-bell-item"
                      onClick={() => { setBellOpen(false); navigate("/patient-reports"); }}
                    >
                      <span>新上传报告</span>
                      <em>{reviewCount}</em>
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="portal-avatar">{(user?.username || "G").slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <section className="portal-content" id="overview">
          <div className="portal-welcome">
            <div>
              <span className="eyebrow">CLINICAL GENOMICS WORKSPACE</span>
              <h2>{role === "client" ? "您的检测进度与报告" : "患者报告与审核工作台"}</h2>
              <p>{role === "client" ? "查看已发布报告与变异证据。" : "管理患者与报告、审核发布；数据由 API Key 导入。"}</p>
            </div>
            {canOperate && (
              <Link className="button button-primary" to="/patient-reports">
                <i className="fas fa-file-medical" /> 打开患者报告
              </Link>
            )}
          </div>

          <div className="metric-grid">
            {[
              ["报告总数", `${reports.length}`, "fa-file-medical", "soft-purple"],
              ["待审核", `${reviewCount}`, "fa-clipboard-check", "soft-orange"],
              ["已发布", `${reports.filter((r) => r.status === "released").length}`, "fa-check-circle", "soft-green"],
              ["官网新留言", `${msgNew}`, "fa-comments", "soft-blue"],
            ].map(([label, value, icon, tone]) => (
              <article className={`metric-card ${tone}`} key={label}>
                <div>
                  <span>{label}</span>
                  <strong>{loading && label === "报告总数" ? "…" : value}</strong>
                </div>
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
                      <span className={`activity-icon ${report.status === "released" ? "green" : "orange"}`}>
                        <i className="fas fa-circle" />
                      </span>
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
                  <p>{role === "client" ? "报告发布后可在个人报告中心查看与下载" : "在患者报告页审核，确认后发布给患者"}</p>
                </div>
              </div>
              {canOperate ? (
                <div className="empty-state">
                  请前往 <Link to="/patient-reports">患者报告</Link> 审核并发布；导入请用 API Key。
                </div>
              ) : (
                <div className="empty-state">登录后可在「个人报告」查看已发布报告。</div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
