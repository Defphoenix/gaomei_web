import React, { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MotionIcon } from "./PublicMotion";
import TechMegaMenu from "./TechMegaMenu";

const Header: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const close = () => setOpen(false);
  const isInternal = !!user && ["admin", "analyst", "reviewer"].includes(user.role);
  const showPersonalReports = isAuthenticated && (user?.report_count || 0) > 0;

  const simpleNav = [
    ["/", "首页"],
    ["/about", "关于我们"],
    ["/products", "产品方案"],
    ["/blog", "资讯中心"],
    ["/contact", "联系 / 加入"],
  ] as const;

  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link to="/" className="brand" onClick={close}>
          <img className="brand-mark-img" src="/assets/images/logo_mark.png" alt="高美基因" />
          <span><b>Gomics</b><small>高美基因</small></span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="打开导航" aria-expanded={open}><i className={`fas ${open ? "fa-times" : "fa-bars"}`} /></button>
        <nav className={open ? "main-nav open" : "main-nav"}>
          {simpleNav.slice(0, 2).map(([to, label]) => (
            <NavLink key={to} to={to} onClick={close} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>
          ))}
          <TechMegaMenu active={location.pathname.startsWith("/tech")} onNavigate={close} />
          {simpleNav.slice(2).map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={close}
              className={({ isActive }) => {
                if (to === "/products") return location.pathname.startsWith("/products") ? "active" : "";
                return isActive ? "active" : "";
              }}
            >
              {label}
            </NavLink>
          ))}
          {open && (
            <Link className="mobile-tech-link" to="/tech" onClick={close}>技术平台总览</Link>
          )}
        </nav>
        <div className="header-actions">
          {isAuthenticated ? <>
            {showPersonalReports && (
              <Link className="header-reports-link" to="/my-reports">
                <i className="fas fa-file-medical" /> 个人报告
              </Link>
            )}
            {user?.role === "admin" && <Link className="admin-news-link" to="/blog/manage"><i className="fas fa-newspaper" /> 资讯管理</Link>}
            {isInternal && <Link className="wiki-nav-link" to="/bioblog"><MotionIcon variant="network" />生信 Wiki</Link>}
            <Link className="header-user" to={isInternal ? "/dashboard" : user?.report_count ? "/my-reports" : "/"}><i className="fas fa-user-circle" /> {user?.username}</Link>
            <button className="button button-small button-outline" onClick={() => { logout(); navigate("/"); }}>退出</button>
          </> : <>
            <Link className="login-link" to="/login">登录</Link>
            <Link className="button button-small button-primary" to="/register">免费注册</Link>
          </>}
        </div>
      </div>
    </header>
  );
};

export default Header;
