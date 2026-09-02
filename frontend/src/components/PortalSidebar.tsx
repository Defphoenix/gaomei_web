import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADMIN_MODULES = [
  { key: "patients", label: "患者管理", icon: "fa-user-injured" },
  { key: "reports", label: "报告管理", icon: "fa-file-medical" },
  { key: "assets", label: "文件管理", icon: "fa-folder-open" },
  { key: "variants", label: "变异管理", icon: "fa-dna" },
  { key: "access_logs", label: "访问日志", icon: "fa-history" },
  { key: "ingest_events", label: "导入管理", icon: "fa-cloud-upload-alt" },
  { key: "users", label: "用户与权限", icon: "fa-users-cog" },
  { key: "api_keys", label: "导入 API Key", icon: "fa-key" },
] as const;

/** Shared left nav for internal portal pages. */
const PortalSidebar: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || (user?.is_staff ? "admin" : "customer");
  const canOperate = ["admin", "analyst", "reviewer"].includes(role) || !!user?.is_staff;
  const isAdmin = role === "admin" || !!user?.is_staff;
  const path = location.pathname;
  const onDashboard = path === "/dashboard";
  const onPatientReports = path === "/patient-reports";
  const onContactMessages = path === "/contact-messages";
  const onDbBrowser = path === "/db-browser";
  const activeTable = onDbBrowser ? (new URLSearchParams(location.search).get("table") || "patients") : "";

  return (
    <aside className="portal-sidebar">
      <Link to="/" className="portal-logo">
        <img className="brand-mark-img" src="/assets/images/logo_mark.png" alt="高美基因" />
        <span><b>Gomics</b><small>后台管理系统</small></span>
      </Link>
      <nav>
        <Link className={onDashboard ? "active" : undefined} to="/dashboard" title="仪表盘">
          <i className="fas fa-th-large" />仪表盘
        </Link>
        {canOperate && (
          <Link className={onPatientReports ? "active" : undefined} to="/patient-reports" title="患者报告">
            <i className="fas fa-file-medical" />患者报告
          </Link>
        )}
        {isAdmin && ADMIN_MODULES.map((m) => (
          <Link
            key={m.key}
            className={onDbBrowser && activeTable === m.key ? "active" : undefined}
            to={`/db-browser?table=${m.key}`}
            title={m.label}
          >
            <i className={`fas ${m.icon}`} />{m.label}
          </Link>
        ))}
        {canOperate && (
          <Link className={onContactMessages ? "active" : undefined} to="/contact-messages" title="官网留言">
            <i className="fas fa-comments" />官网留言
          </Link>
        )}
        <Link to="/browser" title="IGV 证据">
          <i className="fas fa-dna" />IGV 证据
        </Link>
      </nav>
      <div className="node-card">
        <span><i className="fas fa-circle" /> 数据导入</span>
        <b>API Key + Package</b>
        <small>POST /api/v1/ingest/reports/package/</small>
      </div>
    </aside>
  );
};

export default PortalSidebar;
