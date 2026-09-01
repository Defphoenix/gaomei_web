import React from "react";
import { Link } from "react-router-dom";
import { AnimatedPage, MotionIcon } from "../../components/PublicMotion";
import { TECH_CATEGORIES } from "../../content/techCatalog";

const TechHubPage: React.FC = () => (
  <AnimatedPage className="tech-hub-overview">
    <div className="tech-hub-intro">
      <div className="tech-hub-intro-copy">
        <span className="eyebrow">TECHNOLOGY PLATFORM</span>
        <p className="tech-hub-tagline">
          肿瘤基因组 · 表观遗传 · AI 模型
          <em>突变与甲基化双维度 · 实验—计算—临床全链条</em>
        </p>
      </div>
      <div className="tech-hub-intro-actions">
        <a className="button button-small button-primary" href="/assets/tech-platform-architecture.html" target="_blank" rel="noreferrer">
          架构图
        </a>
        <Link className="button button-small button-outline" to="/contact?intent=consult#consultation-form">发起咨询</Link>
      </div>
    </div>

    <h1 className="tech-hub-section-title">实验与计算技术平台</h1>
    <p className="tech-hub-lead">
      五大多组学实验体系与自主计算平台：WES / Panel / TAPS、WGBS / RRBS / ATAC / ChIP、
      转录组、单细胞、cfDNA 液体活检，以及 BseQC、MOABS 与 AI 早筛模型。
    </p>

    <div className="tech-hub-category-grid">
      {TECH_CATEGORIES.map((cat) => (
        <article key={cat.id} className="tech-hub-category-card">
          <header>
            <MotionIcon variant={cat.id === "compute" ? "cloud" : cat.id === "liquid" ? "target" : "dna"} />
            <div>
              <h2>{cat.title}</h2>
              <p>{cat.brief}</p>
            </div>
          </header>
          <ul>
            {cat.links.map((link) => (
              <li key={link.slug}>
                <Link to={`/tech/${link.slug}`}>
                  <b>{link.title}</b>
                  <span>{link.brief}</span>
                  <i className="fas fa-arrow-right" />
                </Link>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  </AnimatedPage>
);

export default TechHubPage;
