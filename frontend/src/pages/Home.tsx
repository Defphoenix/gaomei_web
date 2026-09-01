import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { BlogPost, HomepageData, ServiceItem } from "../types";
import { MotionIcon, usePublicMotion } from "../components/PublicMotion";
import MagneticButton from "../components/MagneticButton";
import { featuredNewsFallback } from "../components/newsAssets";
import PartnerCoverageMap from "../components/PartnerCoverageMap";
import PartnerLogoMarquee from "../components/PartnerLogoMarquee";
import HonorsCardSlider from "../components/HonorsCardSlider";
import { CONTACT_CONSULT_HREF, supportInterpretHref } from "../content/siteContact";

const VIDEO_SRC = "/assets/media/gomics-hero.mp4";

const fallbackServices: ServiceItem[] = [
  { id: 1, title: "肿瘤突变分析", description: "WES、靶向 Panel 与 TAPS，解析 SNV、InDel、CNV，支持突变与甲基化双维度分析。", icon: "dna" },
  { id: 2, title: "cfDNA 甲基化早筛", description: "基于外周血 cfDNA 甲基化信号的风险评估，聚焦肝癌、肺癌等癌种辅助筛查。", icon: "target" },
  { id: 3, title: "表观基因组检测", description: "WGBS、RRBS、ATAC-seq、ChIP-seq 等，覆盖 DNA 甲基化与染色质修饰研究。", icon: "microscope" },
  { id: 4, title: "单细胞多组学", description: "scRNA-seq、scWGBS、scATAC-seq，在单细胞分辨率解析肿瘤异质性。", icon: "network" },
];

const iconVariants = ["dna", "target", "microscope", "network"] as const;

/** Homepage capability cards → matching tech service routes */
const capabilityTechLinks = [
  "/tech/wes",
  "/tech/cfdna-methylation",
  "/tech/wgbs",
  "/tech/scrna-seq",
] as const;

const Home: React.FC = () => {
  const [data, setData] = useState<HomepageData | null>(null);
  const [latestNews, setLatestNews] = useState<BlogPost[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const pageRef = usePublicMotion(data);

  useEffect(() => {
    api.get("/company/homepage/").then((res) => setData(res.data)).catch(() => setData(null));
    api.get("/blog/latest/").then((res) => setLatestNews(res.data)).catch(() => setLatestNews([]));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const constrained = connection?.saveData || connection?.effectiveType === "2g";
    if (reducedMotion || constrained) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVideoEnabled(true); observer.disconnect(); }
    }, { rootMargin: "180px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (videoEnabled) videoRef.current?.play().catch(() => undefined); }, [videoEnabled]);

  const services = data?.services?.length ? data.services : fallbackServices;
  // Keep the homepage and the information center on the exact same
  // administrator-selected source and ordering.
  const news = latestNews.length ? latestNews : (data?.latest_posts || []);

  return (
    <div ref={pageRef} className="public-page animated-public-page home-original">
      <section className="home-hero">
        <div className="hero-tech-lines" />
        <div className="site-container home-hero-grid">
          <div className="hero-copy motion-hero">
            <span className="eyebrow dark"><i /> TUMOR GENOMICS × EPIGENETICS × AI</span>
            <h1>让天下无癌<br /><span>用真实数据守护生命</span></h1>
            <p>高美基因以表观遗传学为核心、肿瘤基因组学为支柱，构建从突变分析到 cfDNA 甲基化早筛的完整技术体系，为临床与科研提供可落地的精准医学方案。</p>
            <div className="hero-actions">
              <MagneticButton className="button button-primary" to="/products">
                探索产品方案 <i className="fas fa-arrow-right" />
              </MagneticButton>
              <Link className="button button-ghost" to={supportInterpretHref("/")}>预约产品解读</Link>
              <Link className="button button-ghost" to={CONTACT_CONSULT_HREF}>发起咨询</Link>
            </div>
            <div className="hero-proof">
              <span><b>7,000+</b> 累计样本</span><span><b>40+</b> 合作机构</span><span><b>12</b> 覆盖癌种</span>
            </div>
          </div>
          <div className="hero-video-shell ambient-float">
            <div className="video-grid" />
            <video ref={videoRef} className="hero-video" muted loop playsInline preload="metadata" poster="/assets/images/hero_bg.png" aria-label="高美基因 DNA 科技视频">
              <source src={VIDEO_SRC} type="video/mp4" />
            </video>
            <div className="video-vignette" />
            <div className="hero-video-hud">
              <span className="hud-corner hud-one" /><span className="hud-corner hud-two" />
              <svg className="svg-orbit video-orbit" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeDasharray="12 8" /></svg>
            </div>
            <div className="video-status"><span /> LAB / LIVE RESEARCH</div>
            <div className="video-caption"><small>GOMICS OMICS PLATFORM</small><strong>从样本到洞见</strong><p>标准化流程 · 全链路质控 · 结果可追溯</p></div>
          </div>
        </div>
        <div className="scroll-cue"><span>SCROLL TO DISCOVER</span><i /></div>
      </section>

      <PartnerLogoMarquee />

      <section className="section impact-section">
        <div className="site-container">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">OUR IMPACT</span><h2>以可信数据支持每一次判断</h2></div>
          <div className="impact-numbers motion-stagger">
            <div><b data-count="7000" data-suffix="+">0</b><span>累计样本</span></div>
            <div><b data-count="40" data-suffix="+">0</b><span>合作机构</span></div>
            <div><b data-count="12" data-suffix="">0</b><span>覆盖癌种</span></div>
            <div><b data-count="5" data-suffix="">0</b><span>实验技术平台</span></div>
          </div>
        </div>
      </section>

      <PartnerCoverageMap />

      <HonorsCardSlider />

      <section className="section home-services">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal">
            <div><span className="eyebrow">OUR CAPABILITIES</span><h2>覆盖研究与临床的组学能力</h2></div>
            <p>从样本处理、测序分析到结果审核与报告发布，让复杂的生物信息流程变得清晰、可靠。</p>
          </div>
          <div className="capability-grid motion-stagger">
            {services.slice(0, 4).map((service, index) => (
              <Link
                className="capability-card capability-button tech-hover-card"
                key={service.id}
                to={capabilityTechLinks[index] || "/tech"}
              >
                <div className="capability-top"><MotionIcon variant={iconVariants[index]} /><span>0{index + 1}</span></div>
                <h3>{service.title}</h3><p>{service.description}</p>
                <span className="capability-action">查看详细说明 <i className="fas fa-arrow-right" /></span>
                <div className="card-scan-line" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section algorithm-section">
        <div className="algorithm-grid-bg" />
        <div className="site-container algorithm-grid">
          <div className="algorithm-visual motion-reveal">
            <div className="data-core"><MotionIcon variant="network" /><span>GOMICS AI</span></div>
            <div className="data-ring ring-one svg-orbit" /><div className="data-ring ring-two svg-orbit-reverse" />
            <div className="algorithm-note note-one"><code>// AI SCREENING</code><p>美甘鑫 / 美甘飞 风险评估模型</p></div>
            <div className="algorithm-note note-two"><code>// PIPELINE</code><p>BseQC · RRBSMAP · MOABS 自研算法</p></div>
          </div>
          <div className="motion-reveal"><span className="eyebrow dark">COMPUTING PLATFORM</span><h2>自主算法与 AI 早筛模型</h2><p className="lead">覆盖质控、比对、定量与特征挖掘的全流程生信体系，融合随机森林、XGBoost 等多模型框架，将 cfDNA 甲基化与突变信号转化为风险评估结果。</p>
            <ul className="check-list"><li>MOABS 等算法发表于 Nucleic Acids Research</li><li>国人专属 cfDNA 甲基化数据库</li><li>肝癌、肺癌早筛模型持续向泛癌种拓展</li></ul>
            <Link className="text-link light-link" to="/about#technology-platform">了解算法实验室 <i className="fas fa-arrow-right" /></Link>
          </div>
        </div>
      </section>

      <section className="section news-section">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal"><div><span className="eyebrow">SELECTED INSIGHTS</span><h2>资讯与研究进展</h2></div><div className="heading-action"><p>管理员可在资讯管理中选择这里展示的文章。</p><Link to="/blog">查看全部资讯 <i className="fas fa-arrow-right" /></Link></div></div>
          <div className="home-news-grid motion-stagger">
            {(news.length ? news : [null, null, null]).slice(0, 3).map((post: BlogPost | null, index) => {
              const link = post?.wechat_link || (post ? `/blog/${post.slug}` : "/blog");
              return <a className="home-news-card" href={link} key={post?.id || index} target={post?.wechat_link ? "_blank" : undefined} rel="noreferrer">
                <div className="news-image"><img src={post?.featured_image_url || featuredNewsFallback(index)} alt={post?.title || "高美基因资讯"} /><span>{post?.category_name || ["公司动态", "科研进展", "产品更新"][index]}</span><div className="news-image-scan" /></div>
                <div className="news-copy"><small>{post?.published_at ? new Date(post.published_at).toLocaleDateString("zh-CN") : "2026 · GOMICS"}</small><h3>{post?.title || ["高美基因精准组学服务能力持续升级", "多组学在肿瘤早筛中的研究进展", "智能生信协作平台正式进入内测"][index]}</h3><p>{post?.summary || "探索生命数据背后的科学价值，让研究成果更快抵达临床应用。"}</p><span className="news-link">阅读更多 <i className="fas fa-arrow-right" /></span></div>
              </a>;
            })}
          </div>
        </div>
      </section>

      <section className="section consultation-section">
        <div className="site-container consultation-banner motion-reveal">
          <div className="consult-orbit"><MotionIcon variant="target" /></div>
          <div><span className="eyebrow">START A CONVERSATION</span><h2>准备好开启您的研究了吗？</h2><p>从科研方案、检测产品到私有化部署，我们会根据团队现状给出清晰的落地路径。</p></div>
          <MagneticButton className="button button-primary" to={supportInterpretHref("/")}>
            预约产品解读 <i className="fas fa-arrow-right" />
          </MagneticButton>
        </div>
      </section>
    </div>
  );
};

export default Home;
