import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthVisual from "../components/AuthVisual";

const Register: React.FC = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const strength = useMemo(() => Math.min(4, [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== passwordConfirm) { setError("两次密码不一致"); return; }
    setLoading(true);
    try {
      const loggedIn = await register(username, email, password, passwordConfirm);
      navigate(loggedIn.report_count > 0 ? "/my-reports" : "/");
    } catch (err: any) {
      const data = err.response?.data;
      setError(data ? Object.values(data).flat().join(", ") : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <AuthVisual mode="register" />
      <div className="auth-form-side">
        <form className="auth-form enhanced-auth-form auth-form-wide" onSubmit={handleSubmit}>
          <div className="auth-form-mark"><i className="fas fa-user-plus" /></div>
          <span className="eyebrow">CREATE ACCOUNT</span><h2>申请平台访问账号</h2><p>完成基础信息后，将以客户角色进入平台</p>
          {error && <div className="form-error"><i className="fas fa-exclamation-circle" />{error}</div>}
          <div className="auth-field-grid">
            <label>用户名<div className="auth-input-wrap"><i className="fas fa-user" /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="至少 3 个字符" required minLength={3} /></div></label>
            <label>电子邮箱<div className="auth-input-wrap"><i className="fas fa-envelope" /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="用于接收项目通知" /></div></label>
          </div>
          <label>设置密码<div className="auth-input-wrap"><i className="fas fa-key" /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" required minLength={8} /><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}><i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} /></button></div></label>
          <div className="password-strength"><span>{[1, 2, 3, 4].map((level) => <i className={strength >= level ? "is-active" : ""} key={level} />)}</span><small>{["请输入密码", "较弱", "一般", "良好", "强"][strength]}</small></div>
          <label>确认密码<div className="auth-input-wrap"><i className="fas fa-shield-alt" /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="再次输入密码" required minLength={8} /></div></label>
          <label className="auth-consent"><input type="checkbox" required /><span>我了解注册后默认为客户角色，只能访问与本人关联的项目和报告。</span></label>
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? "正在创建账号…" : "创建账号"} <i className="fas fa-arrow-right" /></button>
          <p className="auth-register">已有账号？ <Link to="/login">返回登录</Link></p>
        </form>
      </div>
    </section>
  );
};

export default Register;
