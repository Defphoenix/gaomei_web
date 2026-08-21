import React from "react";
import { Link } from "react-router-dom";
import { MotionIcon } from "./PublicMotion";

type AuthMode = "login" | "register" | "reset";

const content: Record<AuthMode, { eyebrow: string; title: React.ReactNode; text: string; proof: string[] }> = {
  login: {
    eyebrow: "SECURE GENOMICS CLOUD",
    title: <>连接每一次分析<br />与每一个临床答案</>,
    text: "项目、参数、计算、审核与报告，在一个安全且可追溯的工作空间完成。",
    proof: ["角色权限隔离", "全过程审计", "安全访问"],
  },
  register: {
    eyebrow: "JOIN GOMICS PLATFORM",
    title: <>建立您的账号<br />连接检测与报告</>,
    text: "注册后将以客户身份进入平台。项目、报告和证据只对被关联的账号开放。",
    proof: ["默认客户权限", "项目独立关联", "报告安全查看"],
  },
  reset: {
    eyebrow: "LOCAL RECOVERY MODE",
    title: <>快速恢复访问<br />继续您的协作流程</>,
    text: "本地开发阶段允许快速修改密码。云端部署时该入口会自动关闭并替换为正式身份验证流程。",
    proof: ["仅本地开放", "密码强度检查", "云端默认关闭"],
  },
};

const AuthVisual: React.FC<{ mode: AuthMode }> = ({ mode }) => {
  const copy = content[mode];
  return (
    <div className={`auth-visual auth-visual-${mode}`}>
      <Link to="/" className="brand auth-brand"><span className="brand-mark"><i className="fas fa-dna" /></span><span><b>Gomics</b><small>高美基因</small></span></Link>
      <div className="auth-visual-core">
        <div className="auth-orbit"><MotionIcon variant={mode === "reset" ? "shield" : mode === "register" ? "network" : "dna"} /></div>
        <span className="eyebrow dark">{copy.eyebrow}</span>
        <h1>{copy.title}</h1><p>{copy.text}</p>
        <div className="auth-data-flow"><span>SAMPLE</span><i /><span>ANALYSIS</span><i /><span>REPORT</span></div>
      </div>
      <div className="auth-proof">{copy.proof.map((item, index) => <span key={item}><i className={(["fas fa-user-shield", "fas fa-history", "fas fa-lock"])[index]} />{item}</span>)}</div>
    </div>
  );
};

export default AuthVisual;
