import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import AuthVisual from "../components/AuthVisual";

const ResetPassword: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => Math.min(4, [password.length >= 8, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length), [password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setSuccess("");
    if (password !== passwordConfirm) { setError("两次输入的新密码不一致"); return; }
    setLoading(true);
    try {
      const response = await api.post("/auth/password-reset/", { username, new_password: password, new_password_confirm: passwordConfirm });
      setSuccess(response.data.detail || "密码已修改");
      setPassword(""); setPasswordConfirm("");
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.detail || (data ? Object.values(data).flat().join(", ") : "密码修改失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <AuthVisual mode="reset" />
      <div className="auth-form-side">
        <form className="auth-form enhanced-auth-form" onSubmit={handleSubmit}>
          <div className="auth-form-mark"><i className="fas fa-unlock-alt" /></div>
          <span className="eyebrow">QUICK PASSWORD RESET</span><h2>修改账号密码</h2><p>输入用户名并设置新密码，无需邮件验证</p>
          <div className="development-warning"><i className="fas fa-flask" /><span><b>本地开发功能</b>正式上云后此入口会自动关闭并替换为安全验证流程。</span></div>
          {error && <div className="form-error"><i className="fas fa-exclamation-circle" />{error}</div>}
          {success && <div className="form-success"><i className="fas fa-check-circle" />{success}<Link to="/login">立即登录</Link></div>}
          <label>用户名<div className="auth-input-wrap"><i className="fas fa-user" /><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入需要修改的用户名" required /></div></label>
          <label>新密码<div className="auth-input-wrap"><i className="fas fa-key" /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 个字符" required minLength={8} /><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}><i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} /></button></div></label>
          <div className="password-strength"><span>{[1, 2, 3, 4].map((level) => <i className={strength >= level ? "is-active" : ""} key={level} />)}</span><small>{["请输入密码", "较弱", "一般", "良好", "强"][strength]}</small></div>
          <label>确认新密码<div className="auth-input-wrap"><i className="fas fa-shield-alt" /><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="再次输入新密码" required minLength={8} /></div></label>
          <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? "正在修改密码…" : "确认修改密码"} <i className="fas fa-arrow-right" /></button>
          <p className="auth-register"><Link to="/login"><i className="fas fa-arrow-left" /> 返回登录</Link></p>
        </form>
      </div>
    </section>
  );
};

export default ResetPassword;
