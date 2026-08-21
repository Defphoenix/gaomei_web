import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => (
  <footer className="site-footer">
    <div className="site-container footer-grid">
      <div><div className="footer-brand">Gomics <span>高美基因</span></div><p>专注基因组学研究与精准医学，用可信赖的检测技术为生命健康赋能。</p><div className="socials"><i className="fab fa-weixin" /><i className="fas fa-envelope" /></div></div>
      <div><h3>探索</h3><Link to="/about">关于我们</Link><Link to="/tech">科技服务</Link><Link to="/products">产品方案</Link><Link to="/blog">资讯中心</Link></div>
      <div><h3>服务</h3><span>全外显子组测序</span><span>肿瘤早筛</span><span>生信分析平台</span><span>临床报告</span></div>
      <div><h3>联系我们</h3><span>杭州市西湖区科创园</span><span>400-XXXX-XXXX</span><span>contact@gomics.com.cn</span></div>
    </div>
    <div className="site-container footer-bottom"><span>© {new Date().getFullYear()} Gomics Biotechnology Co., Ltd.</span><span>隐私政策 · 服务条款 · 网站地图</span></div>
  </footer>
);

export default Footer;
