import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const DB_TABLES = [
  { key: "users", label: "用户与权限", hint: "可编辑" },
  { key: "patient_slots", label: "患者报告台账", hint: "只读" },
  { key: "sample_bundles", label: "样本报告包", hint: "只读" },
  { key: "bundle_files", label: "报告包文件路径", hint: "只读" },
  { key: "reports", label: "门户报告", hint: "只读" },
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
  const onDbBrowser = path === "/db-browser";
  const [dbOpen, setDbOpen] = useState(onDbBrowser);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onDbBrowser) setDbOpen(true);
  }, [onDbBrowser]);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!menuRef.current?.contains(ev.target as Node)) {
        if (!onDbBrowser) setDbOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [onDbBrowser]);

  return (
    <aside className="portal-sidebar">
      <Link to="/" className="portal-logo">
        <img className="brand-mark-img" src="/assets/images/logo_mark.png" alt="高美基因" />
        <span><b>Gomics</b><small>高美协作平台</small></span>
      </Link>
      <nav>
        <Link className={onDashboard ? "active" : undefined} to="/dashboard" title="工作台">
          <i className="fas fa-th-large" />工作台
        </Link>
        {canOperate && (
          <Link className={onPatientReports ? "active" : undefined} to="/patient-reports" title="患者报告">
            <i className="fas fa-file-medical" />患者报告
          </Link>
        )}
        {canOperate && (
          <Link to="/dashboard#review" title="审核发布">
            <i className="fas fa-clipboard-check" />审核发布
          </Link>
        )}
        <Link to="/browser" title="IGV 证据">
          <i className="fas fa-dna" />IGV 证据
        </Link>
        {isAdmin && (
          <div className={`portal-nav-group ${dbOpen || onDbBrowser ? "open" : ""}`} ref={menuRef}>
            <button
              type="button"
              className={onDbBrowser ? "active" : undefined}
              title="用户与权限 / 数据表"
              onClick={() => setDbOpen((v) => !v)}
            >
              <i className="fas fa-users-cog" />
              <span>用户与权限</span>
              <i className={`fas fa-chevron-${dbOpen ? "up" : "down"} nav-caret`} />
            </button>
            {dbOpen && (
              <div className="portal-nav-submenu">
                {DB_TABLES.map((t) => (
                  <Link
                    key={t.key}
                    to={`/db-browser?table=${t.key}`}
                    className={onDbBrowser && new URLSearchParams(location.search).get("table") === t.key ? "active" : undefined}
                    title={t.hint}
                  >
                    {t.label}
                    <small>{t.hint}</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>
      <div className="node-card">
        <span><i className="fas fa-circle" /> 患者报告</span>
        <b>云端排版与发布</b>
        <small>node9 上传 JSON / 附属文件</small>
      </div>
    </aside>
  );
};

export default PortalSidebar;
