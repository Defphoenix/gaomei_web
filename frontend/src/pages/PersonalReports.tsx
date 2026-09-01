import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Report } from "../types";
import { MotionIcon } from "../components/PublicMotion";

const PersonalReports: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const isInternal = !!user && ["admin", "analyst", "reviewer"].includes(user.role);

  useEffect(() => {
    api.get("/reports/").then((res) => setReports(res.data)).catch(() => setReports([])).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => reports.filter((report) =>
    `${report.title}${report.sample_id}${report.patient_name || ""}`.toLowerCase().includes(query.toLowerCase())
  ), [reports, query]);

  return (
    <section className="personal-reports-page">
      <div className="report-hero-grid" />
      <div className="site-container">
        <div className="reports-heading">
          <div><span className="eyebrow">SECURE REPORT CENTER</span><h1>{isInternal ? "全部检测报告" : "个人报告"}</h1><p>{isInternal ? "查看患者项目、分析结果、变异证据与报告状态。" : "这里展示与您的账号关联的检测报告和分析结果。"}</p></div>
          <MotionIcon variant="report" />
        </div>
        <div className="reports-toolbar">
          <div className="reports-summary"><b>{reports.length}</b><span>{isInternal ? "可访问报告" : "个人报告"}</span></div>
          <label><i className="fas fa-search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isInternal ? "搜索患者、项目或样本编号" : "搜索报告或样本编号"} /></label>
        </div>
        {loading ? <div className="reports-empty">正在读取报告…</div> : filtered.length === 0 ? <div className="reports-empty"><MotionIcon variant="report" /><h2>暂无可查看报告</h2><p>报告发布并关联到您的账号后，会显示在这里。</p></div> :
        <div className="personal-report-grid">
          {filtered.map((report) => <article className="personal-report-card" key={report.id}>
            <div className="report-card-top"><span className={`report-type ${report.report_type}`}>{report.report_type_display}</span><small>{report.report_date}</small></div>
            <h2>{report.title}</h2>
            {isInternal && <p className="report-patient"><i className="fas fa-user" /> {report.patient_name}</p>}
            <div className="report-meta"><span><small>样本编号</small><b>{report.sample_id}</b></span><span><small>结果位点</small><b>{report.item_count} 个</b></span></div>
            <div className="report-status"><i /><span>报告已发布</span></div>
            <div className="report-card-actions">
              <Link to={`/reports/${report.id}`}>查看 3D 报告 <i className="fas fa-cube" /></Link>
              <Link to={`/browser?report=${report.id}`}>IGV 证据</Link>
              {(report.pdf_available || report.report_pdf_url) && (
                <a href={report.report_pdf_download_url || report.report_pdf_url} target="_blank" rel="noreferrer">下载 PDF</a>
              )}
            </div>
          </article>)}
        </div>}
      </div>
    </section>
  );
};

export default PersonalReports;
