import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
          <Link to="/dashboard#users" title="用户与权限">
            <i className="fas fa-users-cog" />用户与权限
          </Link>
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
