import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { BlogPost, HomepageData, ServiceItem, TeamMember } from "../types";
import { MotionIcon, usePublicMotion } from "../components/PublicMotion";
import { featuredNewsFallback } from "../components/newsAssets";

const VIDEO_SRC = "/assets/media/gomics-hero.mp4";

const fallbackServices: ServiceItem[] = [
  { id: 1, title: "肿瘤突变分析", description: "WES、靶向 Panel 与 TAPS，解析 SNV、InDel、CNV，支持突变与甲基化双维度分析。", icon: "dna" },
  { id: 2, title: "cfDNA 甲基化早筛", description: "基于外周血 cfDNA 甲基化信号的风险评估，聚焦肝癌、肺癌等癌种辅助筛查。", icon: "target" },
  { id: 3, title: "表观基因组检测", description: "WGBS、RRBS、ATAC-seq、ChIP-seq 等，覆盖 DNA 甲基化与染色质修饰研究。", icon: "microscope" },
  { id: 4, title: "单细胞多组学", description: "scRNA-seq、scWGBS、scATAC-seq，在单细胞分辨率解析肿瘤异质性。", icon: "network" },
];

const teamPhotoByName: Record<string, string> = {
  孙德强: "/assets/images/team_male_2.jpg",
  熊晶: "/assets/images/team_male_1.jpg",
  张旭丹: "/assets/images/team_female.jpg",
};

const fallbackTeam: TeamMember[] = [
  { id: 1, name: "孙德强", position: "董事长 / 创始人", bio: "高美基因创始人，长期深耕肿瘤基因组学与精准医学方向，推动实验平台、算法体系与临床转化能力建设。", expertise: "肿瘤基因组学，精准医学，临床转化", photo: teamPhotoByName["孙德强"] },
  { id: 2, name: "熊晶", position: "总经理", bio: "负责公司整体运营管理，统筹科研服务、临床检测与产品化落地。", expertise: "运营管理，产品开发，检测服务", photo: teamPhotoByName["熊晶"] },
  { id: 3, name: "张旭丹", position: "董事会秘书", bio: "负责公司治理、对外沟通与战略协同，连接科研、产业与资本资源。", expertise: "公司治理，战略协同，对外合作", photo: teamPhotoByName["张旭丹"] },
];

const iconVariants = ["dna", "target", "microscope", "network"] as const;
const capabilityDetails = [
  {
    label: "SOMATIC GENOMICS", title: "肿瘤突变分析平台",
    intro: "从全外显子组到靶向 Panel，从组织样本到血液 cfDNA，以高深度测序解析体细胞突变与拷贝数变异。",
    points: ["WES 覆盖约 2 万个基因外显子区域", "靶向 Panel 数百至上千×深度检测", "TAPS 一次测序同时获取甲基化与突变信息", "适合分子分型、用药参考与疗效监测"],
    icon: "dna" as const,
  },
  {
    label: "LIQUID BIOPSY", title: "cfDNA 甲基化早筛",
    intro: "面向无创早筛的核心平台，从一管外周血完成 cfDNA 提取、甲基化文库构建与测序检测。",
    points: ["美甘鑫 · 肝癌风险评估模型", "美甘飞 · 肺癌风险评估模型", "全流程质控，低起始量样本稳定检测", "辅助筛查表述，合规风险评估"],
    icon: "target" as const,
  },
  {
    label: "EPIGENOMICS", title: "表观基因组",
    intro: "以 WGBS、RRBS 等行业金标准技术为核心，系统检测 DNA 甲基化与染色质修饰。",
    points: ["WGBS 单碱基分辨率全基因组甲基化", "RRBS 聚焦 CpG 富集调控区域", "ATAC-seq 与 ChIP-seq 解析染色质状态", "覆盖发现级研究与靶向验证"],
    icon: "microscope" as const,
  },
  {
    label: "SINGLE CELL", title: "单细胞多组学",
    intro: "在单个细胞分辨率下解析基因表达、DNA 甲基化与染色质状态，揭示组织异质性与稀有细胞群体。",
    points: ["scRNA-seq 绘制单细胞表达图谱", "scWGBS 追踪甲基化异质性", "scATAC-seq 刻画调控元件激活", "支撑肿瘤微环境与谱系研究"],
    icon: "network" as const,
  },
];

const labDetails = [
  { title: "表观基因组", subtitle: "METHYLOME & CHROMATIN", text: "以 DNA 甲基化与染色质可及性为核心，解析调控元件、细胞状态和疾病相关表观标记。", image: "/assets/images/lab_epigenome.jpg", metrics: ["全基因组甲基化", "ATAC-seq", "单细胞图谱"], icon: "dna" as const },
  { title: "表观转录组", subtitle: "EPITRANSCRIPTOMICS", text: "聚焦 m6A 等 RNA 修饰及其对转录本稳定性、翻译效率与疾病机制的影响。", image: "/assets/images/lab_epigenetics.jpg", metrics: ["m6A-seq", "RNA 调控网络", "功能富集"], icon: "scan" as const },
  { title: "表观微生物", subtitle: "MICROBIOME INTERACTION", text: "结合微生物组结构、宿主响应和表观标记，研究环境、菌群与疾病表型之间的联系。", image: "/assets/images/lab_epimicrobiome.jpg", metrics: ["宏基因组", "宿主互作", "生物标志物"], icon: "microscope" as const },
];

const Home: React.FC = () => {
  const [data, setData] = useState<HomepageData | null>(null);
  const [latestNews, setLatestNews] = useState<BlogPost[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [activeCapability, setActiveCapability] = useState<number | null>(null);
  const [displayedCapability, setDisplayedCapability] = useState(0);
  const [activeLab, setActiveLab] = useState(0);
  const [flippedMember, setFlippedMember] = useState<number | null>(null);
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
  const team = data?.team?.length ? data.team : fallbackTeam;
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
              <Link className="button button-primary magnetic-button" to="/products">探索产品方案 <i className="fas fa-arrow-right" /></Link>
              <Link className="button button-ghost" to="/contact">预约技术咨询</Link>
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

      <section className="section home-services">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal">
            <div><span className="eyebrow">OUR CAPABILITIES</span><h2>覆盖研究与临床的组学能力</h2></div>
            <p>从样本处理、测序分析到结果审核与报告发布，让复杂的生物信息流程变得清晰、可靠。</p>
          </div>
          <div className="capability-grid motion-stagger">
            {services.slice(0, 4).map((service, index) => (
              <button
                type="button"
                className={`capability-card capability-button tech-hover-card ${activeCapability === index ? "is-active" : ""}`}
                key={service.id}
                aria-expanded={activeCapability === index}
                onClick={() => {
                  if (activeCapability === index) {
                    setActiveCapability(null);
                  } else {
                    setDisplayedCapability(index);
                    setActiveCapability(index);
                  }
                }}
              >
                <div className="capability-top"><MotionIcon variant={iconVariants[index]} /><span>0{index + 1}</span></div>
                <h3>{service.title}</h3><p>{service.description}</p>
                <span className="capability-action">{activeCapability === index ? "收起详细说明" : "展开详细说明"} <i className={`fas ${activeCapability === index ? "fa-minus" : "fa-plus"}`} /></span>
                <div className="card-scan-line" />
              </button>
            ))}
          </div>
          <div className={`capability-drawer ${activeCapability !== null ? "is-open" : ""}`} aria-hidden={activeCapability === null}>
            <div className="capability-drawer-inner" key={displayedCapability}>
              <div className="drawer-visual"><MotionIcon variant={capabilityDetails[displayedCapability].icon} /><div className="drawer-radar svg-orbit" /></div>
              <div className="drawer-copy"><span>{capabilityDetails[displayedCapability].label}</span><h3>{capabilityDetails[displayedCapability].title}</h3><p>{capabilityDetails[displayedCapability].intro}</p></div>
              <ul>{capabilityDetails[displayedCapability].points.map((point) => <li key={point}><i className="fas fa-check" />{point}</li>)}</ul>
              <Link className="drawer-cta" to="/tech"><span>进入科技服务页</span><i className="fas fa-arrow-right" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section laboratory-section">
        <div className="site-container">
          <div className="section-heading motion-reveal"><span className="eyebrow">EPIGENETICS LAB</span><h2>表观遗传学实验室</h2><p>在单细胞尺度揭示生命密码，整合 NGS、质谱与生物信息分析能力。</p></div>
          <div className="laboratory-grid">
            <div className="laboratory-image motion-reveal" key={labDetails[activeLab].title}>
              <img className="lab-switch-image" src={labDetails[activeLab].image} alt={labDetails[activeLab].title} />
              <div className="lab-overlay"><span>{labDetails[activeLab].subtitle}</span><h3>{labDetails[activeLab].title}</h3><p>{labDetails[activeLab].text}</p><div className="lab-metrics">{labDetails[activeLab].metrics.map((metric) => <b key={metric}>{metric}</b>)}</div></div>
              <div className="lab-scan" />
            </div>
            <div className="lab-modules motion-stagger">
              {labDetails.map((item, index) => (
                <button type="button" className={activeLab === index ? "is-active" : ""} key={item.title} onClick={() => setActiveLab(index)}><MotionIcon variant={item.icon} /><div><h3>{item.title}</h3><p>{item.text}</p></div><i className="fas fa-arrow-up" /></button>
              ))}
            </div>
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

      <section className="section team-section">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal"><div><span className="eyebrow">OUR LEADERS</span><h2>核心团队</h2></div><p>跨越医学、组学、生物信息和工程领域，把前沿研究转化为可用的临床工具。</p></div>
          <div className="home-team-grid motion-stagger">
            {team.slice(0, 3).map((member, index) => (
              <button type="button" className={`team-card team-flip-card ${flippedMember === member.id ? "is-flipped" : ""}`} key={member.id} aria-pressed={flippedMember === member.id} onClick={() => setFlippedMember(flippedMember === member.id ? null : member.id)}>
                <span className="team-flip-inner">
                  <span className="team-face team-front"><span className="team-photo"><img src={member.photo || teamPhotoByName[member.name] || fallbackTeam[index]?.photo || "/assets/images/team_male_2.jpg"} alt={member.name} /><span className="team-index">0{index + 1}</span><span className="flip-hint"><i className="fas fa-sync-alt" /> 点击了解更多</span></span><strong>{member.name}</strong><em>{member.position}</em></span>
                  <span className="team-face team-back"><MotionIcon variant="network" /><small>CORE TEAM · 0{index + 1}</small><strong>{member.name}</strong><em>{member.position}</em><p>{member.bio || fallbackTeam[index]?.bio}</p><span className="expertise-tags">{(member.expertise || fallbackTeam[index]?.expertise || "精准医学，多组学，临床转化").split(/[，,]/).slice(0, 3).map((tag) => <b key={tag}>{tag.trim()}</b>)}</span><span className="flip-back-hint"><i className="fas fa-undo" /> 点击返回</span></span>
                </span>
              </button>
            ))}
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
          <Link className="button button-primary" to="/contact">联系技术顾问 <i className="fas fa-arrow-right" /></Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
