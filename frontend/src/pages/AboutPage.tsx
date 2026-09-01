import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";

type MotionVariant = React.ComponentProps<typeof MotionIcon>["variant"];

const VIDEO_SRC = "/assets/media/gomics-hero.mp4";

const ABOUT_TABS = [
  { id: "profile", label: "公司概况" },
  { id: "culture", label: "企业文化" },
  { id: "journey", label: "发展历程" },
  { id: "capability", label: "技术与质量" },
] as const;

type AboutTabId = (typeof ABOUT_TABS)[number]["id"];

const cultures = [
  { title: "诚朴", text: "严谨对待每一份样本", detail: "从采血、提取到测序全流程质控，保留关键指标，让检测结果可追溯、可复现。", icon: "shield" as MotionVariant },
  { title: "创新", text: "持续探索技术边界", detail: "布局 WES、TAPS、cfDNA 甲基化与单细胞多组学，推动算法与 AI 模型持续迭代。", icon: "cloud" as MotionVariant },
  { title: "卓越", text: "以更高标准交付", detail: "建立实验、生信与医学解读协同的质量体系，在效率与严谨之间保持平衡。", icon: "target" as MotionVariant },
];

const history = [
  { year: "2018", title: "公司成立", text: "浙江高美基因科技有限公司成立，确立肿瘤基因组学与表观遗传研究方向。", image: "/assets/images/about_one.jpg" },
  { year: "2020", title: "实验平台建设", text: "建立 WGBS、RRBS 等表观基因组检测能力，布局甲基化研究服务。", image: "/assets/images/lab_epigenome.jpg" },
  { year: "2022", title: "早筛模型研发", text: "推进 cfDNA 甲基化早筛模型研发，建设国人专属甲基化数据库。", image: "/assets/images/service_tumor_screening.jpg" },
  { year: "2024", title: "突变分析拓展", text: "完善 WES、靶向 Panel 与 TAPS 肿瘤突变分析平台，形成突变+甲基化双维度能力。", image: "/assets/images/service_companion_diagnostics.jpg" },
  { year: "2026", title: "AI 与全链条服务", text: "融合自主算法与 AI 模型，连接科研服务、临床检测与健康管理服务。", image: "/assets/images/portfolio_one.jpg" },
];

const platforms = [
  {
    id: "somatic", name: "WES / Panel / TAPS", label: "肿瘤突变分析", icon: "dna" as MotionVariant,
    description: "从全外显子组到靶向 Panel，解析 SNV、InDel、CNV；TAPS 可同时获取甲基化与突变信息。",
    specs: ["WES 全外显子", "Panel 高深度", "TAPS 双维度"],
  },
  {
    id: "wgbs", name: "WGBS / RRBS", label: "表观基因组", icon: "scan" as MotionVariant,
    description: "以 WGBS、RRBS 为核心系统检测 DNA 甲基化，配合 ATAC-seq、ChIP-seq 解析染色质状态。",
    specs: ["单碱基甲基化", "CpG 富集", "染色质开放性"],
  },
  {
    id: "cfdna", name: "cfDNA", label: "液体活检早筛", icon: "target" as MotionVariant,
    description: "从一管外周血完成 cfDNA 提取、甲基化文库构建与测序，支撑美甘鑫 / 美甘飞等早筛产品。",
    specs: ["无创采血", "全流程质控", "AI 风险评估"],
  },
  {
    id: "scrna", name: "scRNA / scWGBS", label: "单细胞多组学", icon: "microscope" as MotionVariant,
    description: "在单细胞分辨率解析基因表达、甲基化与染色质状态，揭示肿瘤异质性。",
    specs: ["scRNA-seq", "scWGBS", "scATAC-seq"],
  },
  {
    id: "compute", name: "BseQC / MOABS", label: "计算平台", icon: "cloud" as MotionVariant,
    description: "覆盖质控、比对、定量与特征挖掘的自研算法体系，支撑大规模组学分析。",
    specs: ["BseQC", "RRBSMAP", "MOABS"],
  },
];

const qualityStages = [
  ["01", "样本质控", "核对样本身份、浓度、完整性和配对关系。", "microscope" as MotionVariant],
  ["02", "建库质控", "记录建库批次、片段分布和关键实验指标。", "scan" as MotionVariant],
  ["03", "测序质控", "评估数据量、Q30、比对率、重复率和覆盖均一性。", "network" as MotionVariant],
  ["04", "生信审核", "保存流程版本、参数、过滤步骤及重点证据。", "shield" as MotionVariant],
  ["05", "报告发布", "完成分析员审核、管理员审核和版本化发布。", "report" as MotionVariant],
];

function parseTab(value: string | null): AboutTabId {
  if (value && ABOUT_TABS.some((t) => t.id === value)) return value as AboutTabId;
  return "profile";
}

const AboutPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));
  const [activeCulture, setActiveCulture] = useState(0);
  const [activeHistory, setActiveHistory] = useState(0);
  const [activePlatform, setActivePlatform] = useState(0);
  const [activeQuality, setActiveQuality] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);

  const setTab = (id: AboutTabId) => {
    setSearchParams(id === "profile" ? {} : { tab: id }, { replace: true });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const constrained = connection?.saveData || connection?.effectiveType === "2g";
    if (reducedMotion || constrained) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVideoEnabled(true);
        observer.disconnect();
      }
    }, { rootMargin: "120px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoEnabled) videoRef.current?.play().catch(() => undefined);
  }, [videoEnabled]);

  const platform = platforms[activePlatform];
  const milestone = history[activeHistory];

  return (
    <AnimatedPage className="about-public-page about-redesign">
      <section className="about-hero">
        <div className="hero-tech-lines" />
        <div className="site-container about-hero-grid">
          <div className="about-hero-copy motion-hero">
            <span className="eyebrow dark"><i /> HUMANITY THROUGH DATA</span>
            <h1>关于我们</h1>
            <p className="about-mission-lead">
              <strong>使命：</strong>让天下无癌。
              <br />
              <strong>愿景：</strong>世界一流的泛癌早筛、早诊。
            </p>
            <p>
              高美基因以表观遗传学为核心、肿瘤基因组学为支柱，构建从实验、算法到 AI 早筛的完整能力，为临床与科研提供可落地的精准医学方案。
            </p>
            <div className="hero-actions">
              <button type="button" className="button button-primary" onClick={() => setTab("profile")}>
                了解公司背景
              </button>
              <Link className="button button-ghost" to="/tech">浏览科技服务</Link>
            </div>
          </div>
          <div className="hero-video-shell ambient-float about-hero-video">
            <div className="video-grid" />
            <video
              ref={videoRef}
              className="hero-video"
              muted
              loop
              playsInline
              preload="metadata"
              poster="/assets/images/hero_bg.png"
              aria-label="高美基因公司介绍视频"
            >
              {videoEnabled && <source src={VIDEO_SRC} type="video/mp4" />}
            </video>
            <div className="video-vignette" />
            <div className="hero-video-hud">
              <span className="hud-corner hud-one" /><span className="hud-corner hud-two" />
              <svg className="svg-orbit video-orbit" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeDasharray="12 8" /></svg>
            </div>
            <div className="video-status"><span /> GOMICS / COMPANY</div>
            <div className="video-caption">
              <small>COMPANY INTRO</small>
              <strong>从样本到洞见</strong>
              <p>实验 · 算法 · 产品 · 服务全链条</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-tabs-section">
        <div className="site-container">
          <nav className="about-tab-nav motion-reveal" aria-label="关于我们分类">
            {ABOUT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setTab(tab.id)}
                aria-current={activeTab === tab.id ? "page" : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="about-tab-panel motion-reveal" key={activeTab}>
            {activeTab === "profile" && (
              <div className="about-panel-split about-profile-panel">
                <div className="about-panel-main">
                  <span className="eyebrow">WHO WE ARE</span>
                  <h2>肿瘤基因组 × 表观遗传 × AI 模型</h2>
                  <p className="lead">
                    高美基因构建了从全基因组突变到单细胞多组学、从组织样本到一管外周血的完整技术矩阵，并以自主算法与 AI 模型将其转化为可落地的肿瘤早筛与精准医学方案。
                  </p>
                  <div className="company-tags">
                    <span>肿瘤突变分析</span><span>cfDNA 甲基化</span><span>表观基因组</span><span>单细胞多组学</span><span>AI 早筛</span>
                  </div>
                  <p className="about-arch-link">
                    <a href="/assets/tech-platform-architecture.html" target="_blank" rel="noreferrer">
                      查看技术平台架构图 <i className="fas fa-arrow-right" />
                    </a>
                  </p>
                </div>
                <div className="company-data-panel">
                  <div className="company-orbit"><MotionIcon variant="network" /></div>
                  <small>COMPANY METRICS</small>
                  <strong>实验 → 算法 → 产品 → 服务</strong>
                  <div className="company-metrics">
                    <span><b data-count="7000" data-suffix="+">0</b>累计样本</span>
                    <span><b data-count="40" data-suffix="+">0</b>合作机构</span>
                    <span><b data-count="12" data-suffix="">0</b>覆盖癌种</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "culture" && (
              <div className="about-panel-split about-culture-panel">
                <div className="about-panel-side">
                  <span className="eyebrow">OUR CULTURE</span>
                  <h2>企业文化是工作方式</h2>
                  <div className="selector-list about-compact-list">
                    {cultures.map((item, index) => (
                      <button
                        type="button"
                        className={activeCulture === index ? "is-active" : ""}
                        onClick={() => setActiveCulture(index)}
                        key={item.title}
                      >
                        <b>0{index + 1}</b>
                        <span>{item.title}<small>{item.text}</small></span>
                        <i className="fas fa-arrow-right" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="selector-detail culture-detail">
                  <MotionIcon variant={cultures[activeCulture].icon} />
                  <small>CULTURE · 0{activeCulture + 1}</small>
                  <h3>{cultures[activeCulture].title}</h3>
                  <p>{cultures[activeCulture].detail}</p>
                  <div className="detail-pulse-line"><i /><i /><i /><i /></div>
                </div>
              </div>
            )}

            {activeTab === "journey" && (
              <div className="about-panel-split about-journey-panel">
                <div className="about-journey-years">
                  <span className="eyebrow">OUR JOURNEY</span>
                  <h2>发展历程</h2>
                  <ul>
                    {history.map((item, index) => (
                      <li key={item.year}>
                        <button
                          type="button"
                          className={activeHistory === index ? "is-active" : ""}
                          onClick={() => setActiveHistory(index)}
                        >
                          <b>{item.year}</b>
                          <span>{item.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <article className="about-journey-feature">
                  <div className="about-journey-image">
                    <img src={milestone.image} alt={milestone.title} />
                  </div>
                  <div className="about-journey-copy">
                    <small>{milestone.year} · MILESTONE</small>
                    <h3>{milestone.title}</h3>
                    <p>{milestone.text}</p>
                  </div>
                </article>
              </div>
            )}

            {activeTab === "capability" && (
              <div className="about-capability-panel">
                <div className="about-capability-head">
                  <div>
                    <span className="eyebrow">TECHNOLOGY PLATFORM</span>
                    <h2>主要技术平台</h2>
                  </div>
                  <Link className="text-link" to="/tech">进入科技服务总览 <i className="fas fa-arrow-right" /></Link>
                </div>
                <div className="about-platform-split">
                  <div className="platform-tabs about-platform-tabs">
                    {platforms.map((item, index) => (
                      <button
                        type="button"
                        className={activePlatform === index ? "is-active" : ""}
                        onClick={() => setActivePlatform(index)}
                        key={item.id}
                      >
                        <MotionIcon variant={item.icon} />
                        <span><b>{item.name}</b><small>{item.label}</small></span>
                      </button>
                    ))}
                  </div>
                  <article className="platform-detail about-platform-detail">
                    <div className="platform-detail-head">
                      <span>PLATFORM 0{activePlatform + 1}</span>
                      <MotionIcon variant={platform.icon} />
                    </div>
                    <h3>{platform.name}<small>{platform.label}</small></h3>
                    <p>{platform.description}</p>
                    <div className="platform-specs">{platform.specs.map((s) => <span key={s}>{s}</span>)}</div>
                  </article>
                </div>
                <div className="about-quality-block">
                  <span className="eyebrow">QUALITY SYSTEM</span>
                  <h3>五阶段质量体系</h3>
                  <div className="quality-steps about-quality-steps">
                    {qualityStages.map(([number, title], index) => (
                      <button
                        type="button"
                        onClick={() => setActiveQuality(index)}
                        className={activeQuality === index ? "is-active" : ""}
                        key={number}
                      >
                        <b>{number}</b><span>{title}</span>
                      </button>
                    ))}
                  </div>
                  <div className="quality-detail about-quality-detail">
                    <MotionIcon variant={qualityStages[activeQuality][3] as MotionVariant} />
                    <div>
                      <small>{qualityStages[activeQuality][0]} / QUALITY GATE</small>
                      <h4>{qualityStages[activeQuality][1]}</h4>
                      <p>{qualityStages[activeQuality][2]}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section section-light about-cta-wrap">
        <div className="site-container consultation-banner motion-reveal">
          <div className="consult-orbit"><MotionIcon variant="target" /></div>
          <div>
            <span className="eyebrow">GOMICS CONSULTING</span>
            <h2>准备好开启您的研究了吗？</h2>
            <p>从研究设计到数据交付，我们为每个项目匹配适合的技术路线。</p>
          </div>
          <Link className="button button-primary" to="/?support=interpret">预约产品解读</Link>
        </div>
      </section>
    </AnimatedPage>
  );
};

export default AboutPage;
