import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthVisual from "../components/AuthVisual";

const Login: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (isAuthenticated) navigate("/dashboard", { replace: true }); }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const loggedIn = await login(username, password);
      const internal = ["admin", "analyst", "reviewer"].includes(loggedIn.role);
      navigate(internal ? "/dashboard" : loggedIn.report_count > 0 ? "/my-reports" : "/");
    } catch (err: any) {
      setError(err.response?.data?.detail || "登录失败，请检查用户名和密码");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <AuthVisual mode="login" />
      <div className="auth-form-side">
        <form className="auth-form enhanced-auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-mark"><i className="fas fa-fingerprint" /></div>
          <span className="eyebrow">WELCOME BACK</span><h2>登录高美协作平台</h2><p>使用分配给您的账号进入工作空间</p>
          {error && <div className="form-error"><i className="fas fa-exclamation-circle" />{error}</div>}
          <label>用户名<div className="auth-input-wrap"><i className="fas fa-user" /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" required /></div></label>
          <label>密码<Link className="label-link" to="/reset-password">忘记密码？</Link><div className="auth-input-wrap"><i className="fas fa-key" /><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" required /><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}><i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} /></button></div></label>
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? "正在安全登录…" : "登录平台"} <i className="fas fa-arrow-right" /></button>
          <div className="auth-divider"><span>或</span></div>
          <p className="auth-register">还没有账号？ <Link to="/register">申请访问权限</Link></p>
          <small className="auth-note"><i className="fas fa-info-circle" />普通客户仅可查看与自己关联的项目；分析、审核和管理权限由管理员分配。</small>
        </form>
      </div>
    </section>
  );
};

export default Login;
