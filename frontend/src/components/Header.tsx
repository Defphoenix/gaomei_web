import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MotionIcon } from "./PublicMotion";

const Header: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const close = () => setOpen(false);
  const isInternal = !!user && ["admin", "analyst", "reviewer"].includes(user.role);

  const nav = [
    ["/", "首页", ""],
    ...(isAuthenticated && (user?.report_count || 0) > 0 ? [["/my-reports", "个人报告", "report-nav"]] : []),
    ["/about", "关于我们", ""],
    ["/tech", "科技服务", ""],
    ["/products", "产品方案", ""],
    ["/blog", "资讯中心", ""],
    ["/contact", "联系 / 加入", ""],
  ];

  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link to="/" className="brand" onClick={close}>
          <span className="brand-mark"><i className="fas fa-dna" /></span>
          <span><b>Gomics</b><small>高美基因</small></span>
        </Link>
        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="打开导航" aria-expanded={open}><i className={`fas ${open ? "fa-times" : "fa-bars"}`} /></button>
        <nav className={open ? "main-nav open" : "main-nav"}>
          {nav.map(([to, label, extra]) => <NavLink key={to} to={to} onClick={close} className={({ isActive }) => `${isActive ? "active" : ""} ${extra}`.trim()}>{label}</NavLink>)}
        </nav>
        <div className="header-actions">
          {isAuthenticated ? <>
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
