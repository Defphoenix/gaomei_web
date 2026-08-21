import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import type { BlogPost, HomepageData, ServiceItem, TeamMember } from "../types";
import { MotionIcon, usePublicMotion } from "../components/PublicMotion";
import { featuredNewsFallback } from "../components/newsAssets";

const VIDEO_SRC = "/assets/media/gomics-hero.mp4";

const fallbackServices: ServiceItem[] = [
  { id: 1, title: "全外显子组测序", description: "肿瘤-正常配对分析，覆盖 SNV、Indel、CNV 与 SV。", icon: "dna" },
  { id: 2, title: "精准肿瘤诊断", description: "整合临床证据、变异审核和中文报告交付。", icon: "target" },
  { id: 3, title: "表观遗传研究", description: "甲基化、染色质可及性与单细胞多组学研究。", icon: "microscope" },
  { id: 4, title: "生信协作平台", description: "参数、任务、审核、版本与操作记录全程可追溯。", icon: "network" },
];

const fallbackTeam: TeamMember[] = [
  { id: 1, name: "张伟 博士", position: "创始人兼首席科学家", bio: "专注肿瘤基因组学与精准医学转化。", expertise: "肿瘤基因组学，精准医学，临床转化", photo: "/assets/images/team_one.jpg" },
  { id: 2, name: "李芳 教授", position: "医学顾问", bio: "长期从事肿瘤早筛及临床研究。", expertise: "肿瘤早筛，临床研究，分子诊断", photo: "/assets/images/team_two.jpg" },
  { id: 3, name: "王建国", position: "生物信息负责人", bio: "负责多组学算法与分析平台建设。", expertise: "生物信息，多组学，算法平台", photo: "/assets/images/team_three.jpg" },
  { id: 4, name: "陈晓", position: "临床平台主管", bio: "推动检测产品的标准化与临床应用。", expertise: "临床检测，质量管理，产品转化", photo: "/assets/images/testimonial_one.jpg" },
];

const iconVariants = ["dna", "target", "microscope", "network"] as const;
const capabilityDetails = [
  {
    label: "WES / PAIRED ANALYSIS", title: "全外显子组测序与配对分析",
    intro: "面向肿瘤-正常配对样本的标准化分析，从原始 FASTQ 到最终可审核变异结果，全过程质量可追溯。",
    points: ["支持肿瘤样本与一个或多个正常样本配对", "覆盖 SNV、Indel、CNV 与结构变异分析", "基于 GRCh38 的统一注释与证据分级", "交付结构化结果、中文报告、PDF 与小 BAM"],
    icon: "dna" as const,
  },
  {
    label: "PRECISION ONCOLOGY", title: "精准肿瘤诊断",
    intro: "围绕个体化用药、复发风险和临床证据整合，为每一个最终报告突变建立清晰的解释链路。",
    points: ["体细胞与胚系变异联合解读", "靶向、免疫及临床试验相关证据", "分析员审核与管理员审核双重控制", "突变表与 Tumor / Normal IGV 证据联动"],
    icon: "target" as const,
  },
  {
    label: "EPIGENETICS", title: "表观遗传研究",
    intro: "从 DNA 甲基化、染色质可及性到 RNA 修饰，提供覆盖实验与生物信息分析的表观组学解决方案。",
    points: ["全基因组与目标区域甲基化分析", "单细胞表观组学图谱构建", "染色质开放性与调控网络分析", "多组学联合与功能通路解释"],
    icon: "microscope" as const,
  },
  {
    label: "BIOINFORMATICS CLOUD", title: "生信协作平台",
    intro: "连接云端管理与本地 Linux 计算，让项目创建、参数确认、运行监控、审核和报告发布形成完整闭环。",
    points: ["管理员、生信分析员、审核员和客户权限隔离", "网页端参数确认、任务运行和状态同步", "本地节点资源、日志、失败重试与续跑管理", "报告版本、下载水印与操作审计"],
    icon: "network" as const,
  },
];

const labDetails = [
  { title: "表观基因组", subtitle: "METHYLOME & CHROMATIN", text: "以 DNA 甲基化与染色质可及性为核心，解析调控元件、细胞状态和疾病相关表观标记。", image: "/assets/images/about_one.jpg", metrics: ["全基因组甲基化", "ATAC-seq", "单细胞图谱"], icon: "dna" as const },
  { title: "表观转录组", subtitle: "EPITRANSCRIPTOMICS", text: "聚焦 m6A 等 RNA 修饰及其对转录本稳定性、翻译效率与疾病机制的影响。", image: "/assets/images/feature_uppper_img.jpg", metrics: ["m6A-seq", "RNA 调控网络", "功能富集"], icon: "scan" as const },
  { title: "表观微生物", subtitle: "MICROBIOME INTERACTION", text: "结合微生物组结构、宿主响应和表观标记，研究环境、菌群与疾病表型之间的联系。", image: "/assets/images/service_circle.jpg", metrics: ["宏基因组", "宿主互作", "生物标志物"], icon: "microscope" as const },
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
            <span className="eyebrow dark"><i /> PRECISION GENOMICS · GRCh38</span>
            <h1>让生命数据<br /><span>转化为临床答案</span></h1>
            <p>高美基因以全外显子组测序、肿瘤早筛与生物信息分析为核心，为临床与科研团队提供可追溯、可审核、可持续更新的一体化解决方案。</p>
            <div className="hero-actions">
              <Link className="button button-primary magnetic-button" to="/products">探索解决方案 <i className="fas fa-arrow-right" /></Link>
              <Link className="button button-ghost" to="/contact">预约技术咨询</Link>
            </div>
            <div className="hero-proof">
              <span><b>50,000+</b> 样本处理</span><span><b>99.9%</b> 数据准确率</span><span><b>48h</b> 快速响应</span>
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
            <div className="algorithm-note note-one"><code>// AI DISCOVERY</code><p>识别稳定的甲基化特征信号</p></div>
            <div className="algorithm-note note-two"><code>// PIPELINE</code><p>标准化 WES 全链路质控</p></div>
          </div>
          <div className="motion-reveal"><span className="eyebrow dark">ALGORITHM LAB</span><h2>AI 驱动的生信洞察</h2><p className="lead">数据不仅是代码，更是生命的答案。算法实验室融合机器学习与临床证据，为复杂数据建立可解释、可追溯的分析路径。</p>
            <ul className="check-list"><li>自主研发多组学分析框架</li><li>高通量生物信息计算集群</li><li>生产级数据审计与可追溯</li></ul>
            <Link className="text-link light-link" to="/about#technology-platform">了解算法实验室 <i className="fas fa-arrow-right" /></Link>
          </div>
        </div>
      </section>

      <section className="section impact-section">
        <div className="site-container">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">OUR IMPACT</span><h2>以可信数据支持每一次判断</h2></div>
          <div className="impact-numbers motion-stagger">
            <div><b data-count="50000" data-suffix="+">0</b><span>累计样本</span></div>
            <div><b data-count="120" data-suffix="+">0</b><span>合作机构</span></div>
            <div><b data-count="200" data-suffix="+">0</b><span>科研项目</span></div>
            <div><b data-count="99" data-suffix=".9%">0</b><span>数据准确率</span></div>
          </div>
        </div>
      </section>

      <section className="section team-section">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal"><div><span className="eyebrow">OUR LEADERS</span><h2>核心团队</h2></div><p>跨越医学、组学、生物信息和工程领域，把前沿研究转化为可用的临床工具。</p></div>
          <div className="home-team-grid motion-stagger">
            {team.slice(0, 4).map((member, index) => (
              <button type="button" className={`team-card team-flip-card ${flippedMember === member.id ? "is-flipped" : ""}`} key={member.id} aria-pressed={flippedMember === member.id} onClick={() => setFlippedMember(flippedMember === member.id ? null : member.id)}>
                <span className="team-flip-inner">
                  <span className="team-face team-front"><span className="team-photo"><img src={member.photo || fallbackTeam[index]?.photo || "/assets/images/team_one.jpg"} alt={member.name} /><span className="team-index">0{index + 1}</span><span className="flip-hint"><i className="fas fa-sync-alt" /> 点击了解更多</span></span><strong>{member.name}</strong><em>{member.position}</em></span>
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
