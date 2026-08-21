import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";

type MotionVariant = React.ComponentProps<typeof MotionIcon>["variant"];

const PageHero: React.FC<{ eyebrow: string; title: React.ReactNode; text: string; children?: React.ReactNode }> = ({ eyebrow, title, text, children }) => (
  <section className="inner-hero">
    <div className="hero-tech-lines" />
    <div className="site-container inner-hero-content motion-hero">
      <span className="eyebrow dark">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{text}</p>
      {children}
    </div>
    <div className="inner-hero-orbit"><MotionIcon variant="target" /></div>
  </section>
);

const Cta: React.FC<{ title?: string; text?: string }> = ({
  title = "准备好开启您的研究了吗？",
  text = "从研究设计到数据交付，我们为每个项目匹配适合的技术路线。",
}) => (
  <section className="section section-light">
    <div className="site-container consultation-banner motion-reveal">
      <div className="consult-orbit"><MotionIcon variant="target" /></div>
      <div><span className="eyebrow">GOMICS CONSULTING</span><h2>{title}</h2><p>{text}</p></div>
      <Link className="button button-primary" to="/contact#consultation-form">预约技术咨询</Link>
    </div>
  </section>
);

const values = [
  { title: "企业愿景", brief: "成为值得信赖的精准医学技术伙伴。", detail: "围绕癌症早检、精准诊断与生物信息平台持续投入，让可靠的组学证据进入更多科研和临床场景。", icon: "target" as MotionVariant, color: "#accbee" },
  { title: "企业使命", brief: "更早发现风险，让治疗决策更有依据。", detail: "以标准化实验、可解释算法和可追溯报告连接样本、数据与临床问题，缩短研究成果抵达应用的路径。", icon: "cloud" as MotionVariant, color: "#e7d9ce" },
  { title: "服务理念", brief: "严谨对待数据，也认真理解每个项目。", detail: "从方案评估到结果交付保持清晰沟通，为不同团队提供可复核、可更新、可长期协作的服务体验。", icon: "shield" as MotionVariant, color: "#bdc2e8" },
];

const cultures = [
  { title: "创新", text: "保持好奇，探索科学边界", detail: "关注检测技术、分析算法和产品体验的协同创新，以真实问题推动技术迭代。" },
  { title: "诚信", text: "数据可信，过程可追溯", detail: "保留关键参数、质控指标和审核记录，让每一个结论都能回到证据本身。" },
  { title: "卓越", text: "以更高标准交付结果", detail: "建立实验、生信和报告三级质量检查，在效率与严谨之间取得长期稳定的平衡。" },
  { title: "共赢", text: "与伙伴共享长期价值", detail: "尊重科研与临床团队的专业判断，以开放协作推动项目持续更新和成果转化。" },
];

const history = [
  ["2018", "公司成立", "完成核心团队组建，确立肿瘤基因组学与精准医学方向。"],
  ["2019", "实验平台建设", "建立样本处理、建库和高通量测序的标准化实验能力。"],
  ["2020", "WES 流程建立", "完成肿瘤—正常配对分析流程和关键质量控制体系。"],
  ["2021", "甲基化技术突破", "布局 WGBS 与甲基化标志物研究，拓展早期筛查能力。"],
  ["2022", "临床项目启动", "推动检测、医学解读和中文报告进入完整交付流程。"],
  ["2023", "多组学能力扩展", "整合 Panel、RNA-seq、CNV、融合与免疫相关指标。"],
  ["2024", "生信平台建设", "建立任务追踪、参数管理、证据审核和报告版本体系。"],
  ["2026", "智能协作平台", "连接云端管理与本地 Linux 计算，面向持续更新的项目协作。"],
];

const platforms = [
  {
    id: "wgbs", name: "WGBS", label: "全基因组甲基化", icon: "scan" as MotionVariant,
    description: "在全基因组尺度解析 CpG 位点甲基化状态，用于表观调控、疾病标志物和早期信号研究。",
    specs: ["全基因组 CpG 覆盖", "甲基化水平定量", "DMR 与功能区域"],
    applications: ["肿瘤早筛研究", "发育与衰老", "环境与疾病机制"],
    delivery: "质控报告、甲基化矩阵、差异区域、功能注释及可视化结果。",
  },
  {
    id: "wes", name: "WES", label: "全外显子组测序", icon: "dna" as MotionVariant,
    description: "聚焦蛋白编码区，支持肿瘤—正常配对分析和科研队列变异研究。",
    specs: ["SNV / InDel", "CNV 与 TMB", "配对样本过滤"],
    applications: ["实体瘤研究", "遗传变异研究", "治疗相关标志物"],
    delivery: "原始数据质控、标准化变异表、证据分级、报告数据和最终小 BAM。",
  },
  {
    id: "panel", name: "Panel", label: "高深度靶向测序", icon: "target" as MotionVariant,
    description: "针对重点基因和区域进行高深度检测，适合明确目标、低频变异和随访场景。",
    specs: ["灵活基因集合", "高深度覆盖", "低频变异检测"],
    applications: ["伴随诊断", "复发监控", "重点通路研究"],
    delivery: "目标区域覆盖度、变异结果、热点证据、样本级质量评估。",
  },
  {
    id: "rna", name: "RNA-seq", label: "转录组与融合分析", icon: "network" as MotionVariant,
    description: "从表达谱、可变剪接和融合事件理解肿瘤功能状态及通路变化。",
    specs: ["表达定量", "融合与剪接", "通路富集"],
    applications: ["肿瘤分型", "治疗响应研究", "免疫微环境"],
    delivery: "表达矩阵、差异基因、融合候选、通路结果与可视化图表。",
  },
  {
    id: "multiomics", name: "Bioinformatics", label: "多组学生信平台", icon: "cloud" as MotionVariant,
    description: "将 DNA、RNA、甲基化和临床信息纳入统一的项目、参数与审核框架。",
    specs: ["GRCh38 标准", "参数可追溯", "版本化报告"],
    applications: ["科研队列", "临床转化", "私有化分析平台"],
    delivery: "结构化 JSON、TSV、图表、审核记录、PDF 报告及在线证据查看。",
  },
];

const qualityStages = [
  ["01", "样本质控", "核对样本身份、浓度、完整性和配对关系。"],
  ["02", "建库质控", "记录建库批次、片段分布和关键实验指标。"],
  ["03", "测序质控", "评估数据量、Q30、比对率、重复率和覆盖均一性。"],
  ["04", "生信审核", "保存流程版本、参数、过滤步骤及重点证据。"],
  ["05", "报告发布", "完成分析员审核、管理员审核和版本化发布。"],
];

export const AboutPage: React.FC = () => {
  const [activeValue, setActiveValue] = useState(0);
  const [activeCulture, setActiveCulture] = useState(0);
  const [activePlatform, setActivePlatform] = useState(0);
  const [activeQuality, setActiveQuality] = useState(0);
  const platform = platforms[activePlatform];

  return (
    <AnimatedPage className="about-public-page">
      <PageHero eyebrow="HUMANITY THROUGH DATA" title="关于我们" text="更早发现风险，让可靠的生命数据更快转化为研究与临床答案。">
        <div className="hero-actions">
          <a className="button button-primary" href="#company-profile">了解公司背景</a>
          <a className="button button-ghost" href="#technology-platform">浏览技术平台</a>
        </div>
      </PageHero>

      <section className="section section-light anchor-section" id="company-profile">
        <div className="site-container company-profile-grid">
          <div className="motion-reveal">
            <span className="eyebrow">WHO WE ARE</span>
            <h2>让实验、算法与医学判断在同一条路径上协作</h2>
            <p className="lead">高美基因围绕肿瘤基因组学、甲基化研究和生物信息分析建设完整技术体系，为科研机构、临床团队和生信人员提供从方案设计到报告发布的连续服务。</p>
            <div className="company-tags"><span>科研设计</span><span>标准化检测</span><span>配对分析</span><span>证据审核</span><span>版本化报告</span></div>
          </div>
          <div className="company-data-panel motion-reveal">
            <div className="company-orbit"><MotionIcon variant="network" /></div>
            <small>INTEGRATED CAPABILITY</small>
            <strong>Sample → Data → Evidence → Report</strong>
            <div className="company-metrics">
              <span><b data-count="5" data-suffix="+">0</b>技术平台</span>
              <span><b data-count="4">0</b>审核角色</span>
              <span><b data-count="38" data-suffix="">0</b>参考基因组</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-tint anchor-section" id="purpose">
        <div className="site-container">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">OUR PURPOSE</span><h2>核心价值与愿景</h2><p>点击卡片展开更完整的说明。</p></div>
          <div className="value-grid motion-stagger">
            {values.map((item, index) => (
              <button className={`value-card interactive-card ${activeValue === index ? "is-active" : ""}`} type="button" key={item.title} aria-expanded={activeValue === index} onClick={() => setActiveValue(index)}>
                <span style={{ background: item.color }}><MotionIcon variant={item.icon} /></span>
                <h3>{item.title}</h3><p>{item.brief}</p>
                <small>{activeValue === index ? "收起说明" : "展开说明"} <i className={`fas fa-chevron-${activeValue === index ? "up" : "down"}`} /></small>
              </button>
            ))}
          </div>
          <div className="wide-detail-panel motion-reveal" key={activeValue}>
            <span>0{activeValue + 1} / VALUE SYSTEM</span><h3>{values[activeValue].title}</h3><p>{values[activeValue].detail}</p>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="site-container culture-selector">
          <div className="motion-reveal"><span className="eyebrow">OUR CULTURE</span><h2>企业文化不是口号，而是工作方式</h2><p>选择左侧主题，在右侧查看它如何影响数据、项目和协作。</p>
            <div className="selector-list">
              {cultures.map((item, index) => <button type="button" className={activeCulture === index ? "is-active" : ""} onClick={() => setActiveCulture(index)} key={item.title}><b>0{index + 1}</b><span>{item.title}<small>{item.text}</small></span><i className="fas fa-arrow-right" /></button>)}
            </div>
          </div>
          <div className="selector-detail culture-detail motion-reveal" key={activeCulture}>
            <MotionIcon variant={(["target", "shield", "report", "network"] as MotionVariant[])[activeCulture]} />
            <small>CULTURE · 0{activeCulture + 1}</small><h3>{cultures[activeCulture].title}</h3><p>{cultures[activeCulture].detail}</p>
            <div className="detail-pulse-line"><i /><i /><i /><i /></div>
          </div>
        </div>
      </section>

      <section className="section section-tint journey-section">
        <div className="site-container extended-timeline">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">OUR JOURNEY</span><h2>发展历程</h2><p>每一步能力建设，都为下一阶段的临床与科研协作提供基础。</p></div>
          <div className="timeline-motion-line" />
          {history.map(([year, title, text], index) => (
            <article className={`journey-item motion-reveal ${index % 2 ? "journey-right" : "journey-left"}`} key={year}>
              <div><b>{year}</b><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-dark anchor-section" id="technology-platform">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal">
            <div><span className="eyebrow dark">TECHNOLOGY PLATFORM</span><h2>主要技术平台</h2></div>
            <p>从甲基化、外显子、靶向 Panel 到 RNA 与多组学分析，为不同问题匹配合适的数据尺度。</p>
          </div>
          <div className="platform-selector">
            <div className="platform-tabs motion-stagger">
              {platforms.map((item, index) => <button type="button" className={activePlatform === index ? "is-active" : ""} onClick={() => setActivePlatform(index)} key={item.id}><MotionIcon variant={item.icon} /><span><b>{item.name}</b><small>{item.label}</small></span><i className="fas fa-arrow-right" /></button>)}
            </div>
            <article className="platform-detail" key={platform.id}>
              <div className="platform-detail-head"><span>PLATFORM 0{activePlatform + 1}</span><MotionIcon variant={platform.icon} /></div>
              <h3>{platform.name}<small>{platform.label}</small></h3><p>{platform.description}</p>
              <div className="platform-specs">{platform.specs.map((item) => <span key={item}>{item}</span>)}</div>
              <div className="platform-columns"><div><b>适用方向</b>{platform.applications.map((item) => <p key={item}><i className="fas fa-check" />{item}</p>)}</div><div><b>主要交付</b><p>{platform.delivery}</p></div></div>
            </article>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="site-container quality-system">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">QUALITY SYSTEM</span><h2>五阶段质量体系</h2><p>点击每个阶段查看关键控制内容。</p></div>
          <div className="quality-steps motion-stagger">{qualityStages.map(([number, title], index) => <button type="button" onClick={() => setActiveQuality(index)} className={activeQuality === index ? "is-active" : ""} key={number}><b>{number}</b><span>{title}</span></button>)}</div>
          <div className="quality-detail" key={activeQuality}><MotionIcon variant={(["microscope", "scan", "network", "shield", "report"] as MotionVariant[])[activeQuality]} /><div><small>{qualityStages[activeQuality][0]} / QUALITY GATE</small><h3>{qualityStages[activeQuality][1]}</h3><p>{qualityStages[activeQuality][2]}</p></div></div>
        </div>
      </section>
      <Cta />
    </AnimatedPage>
  );
};

const oncologyServices = [
  {
    id: "screening", name: "肿瘤早筛", label: "EARLY DETECTION", icon: "target" as MotionVariant, image: "/assets/images/about_one.jpg",
    intro: "通过甲基化与多组学信号识别早期风险，为研究队列和高风险人群管理提供分层依据。",
    bullets: ["风险信号识别", "多癌种研究策略", "队列级模型评估"], samples: "血液、组织及研究方案规定的其他样本",
  },
  {
    id: "therapy", name: "晚期治疗方案制定", label: "THERAPY DECISION", icon: "dna" as MotionVariant, image: "/assets/images/feature_uppper_img.jpg",
    intro: "结合肿瘤—正常配对 WES、深度 Panel 和临床证据，整理可能影响治疗选择的重要分子信息。",
    bullets: ["驱动变异与通路", "靶向治疗相关证据", "免疫相关标志物"], samples: "肿瘤组织 + 配对正常样本，必要时结合血液",
  },
  {
    id: "companion", name: "伴随诊断", label: "COMPANION DIAGNOSTICS", icon: "microscope" as MotionVariant, image: "/assets/images/feature_down_img.jpg",
    intro: "围绕明确药物或治疗路径配置重点基因、融合、拷贝数和免疫标志物分析。",
    bullets: ["MSI / TMB / HRD", "融合与扩增缺失", "重点药物相关位点"], samples: "FFPE、手术组织、活检及合格核酸",
  },
  {
    id: "monitoring", name: "复发与疗效监测", label: "LONGITUDINAL MONITORING", icon: "scan" as MotionVariant, image: "/assets/images/about_two.jpg",
    intro: "以纵向采样和重点位点追踪观察治疗前后变化，为复发风险研究和持续随访提供数据支持。",
    bullets: ["基线变异建立", "低频信号追踪", "多时间点趋势"], samples: "连续血液样本及对应基线组织",
  },
];

const biomarkers = [
  ["MSI", "微卫星不稳定性", "免疫治疗相关分子特征"],
  ["TMB", "肿瘤突变负荷", "结合检测范围和质控进行解释"],
  ["HRD", "同源重组缺陷", "整合基因与基因组不稳定特征"],
  ["Fusion", "基因融合", "结合 DNA 与 RNA 证据识别"],
  ["CNV", "拷贝数变异", "关注扩增、缺失与结构变化"],
  ["Neoantigen", "新抗原候选", "仅展示经过过滤的候选结果"],
];

const analysisSteps = [
  ["样本与配对审核", "确认肿瘤、正常样本关系，检查编号、类型、质量及项目信息。"],
  ["参数表确认", "分析员在提交前查看并调整 BED、过滤阈值和启用模块。"],
  ["本地 Linux 计算", "任务在本地节点运行，云端同步展示节点和步骤状态。"],
  ["变异证据审核", "结合最终变异表和 tumor/normal 小 BAM 进行 IGV 证据查看。"],
  ["报告审核发布", "分析员审核后进入管理员审核，正式发布 PDF 与在线报告。"],
];

const serviceFaq = [
  ["如何选择 WES 还是 Panel？", "探索范围广、需要发现新变异时可优先考虑 WES；目标明确、强调深度和重点位点时可考虑 Panel。最终方案需要结合样本质量与研究目的。"],
  ["为什么推荐肿瘤—正常配对？", "配对正常样本有助于区分体细胞与胚系背景，提高过滤和解释的可靠性。"],
  ["能够提供哪些交付文件？", "可按方案提供质控结果、结构化变异表、注释文件、图表、PDF 报告以及用于在线证据查看的小 BAM。"],
  ["项目重新分析后如何更新？", "本地流程完成后重新上传结构化结果和报告数据，同一项目保留操作记录并更新当前展示版本。"],
];

export const TechPage: React.FC = () => {
  const [activeService, setActiveService] = useState(0);
  const [stage, setStage] = useState("早期风险筛查");
  const [sample, setSample] = useState("组织 + 配对血液");
  const [goal, setGoal] = useState("寻找治疗相关变异");
  const [activeAnalysis, setActiveAnalysis] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const service = oncologyServices[activeService];

  const recommendation = useMemo(() => {
    if (goal === "复发与疗效监测") return "基线组织 Panel + 多时间点血液追踪";
    if (stage === "早期风险筛查") return "甲基化信号 + 多组学风险模型";
    if (sample === "仅肿瘤组织") return "肿瘤 WES / 深度 Panel + 严格背景过滤";
    return "肿瘤—正常配对 WES + 重点标志物分析";
  }, [goal, sample, stage]);

  return (
    <AnimatedPage className="tech-public-page">
      <PageHero eyebrow="PRECISION ONCOLOGY" title={<>肿瘤全周期<br /><span>精准检测服务</span></>} text="从早期风险信号、治疗相关变异到疗效与复发监测，以可追溯的实验和生信流程支持每个阶段的判断。">
        <div className="hero-actions"><Link className="button button-primary" to="/contact#consultation-form">立即咨询</Link><a className="button button-ghost" href="#oncology-services">查看服务体系</a></div>
      </PageHero>

      <section className="section section-light anchor-section" id="oncology-services">
        <div className="site-container">
          <div className="section-heading motion-reveal"><span className="eyebrow">ONCOLOGY SERVICES</span><h2>从风险识别到持续随访</h2><p>选择不同阶段，查看适用场景、样本策略与主要分析内容。</p></div>
          <div className="service-explorer">
            <div className="service-visual motion-reveal" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,18,42,.08),rgba(5,18,42,.9)),url('${service.image}')` }}>
              <span>{service.label}</span><MotionIcon variant={service.icon} /><h3>{service.name}</h3><p>{service.intro}</p>
              <div>{service.bullets.map((item) => <b key={item}>{item}</b>)}</div>
            </div>
            <div className="service-choice-list motion-stagger">
              {oncologyServices.map((item, index) => <button type="button" className={activeService === index ? "is-active" : ""} onClick={() => setActiveService(index)} key={item.id}><small>0{index + 1}</small><span><b>{item.name}</b><em>{item.label}</em></span><MotionIcon variant={item.icon} /></button>)}
              <div className="service-sample-note"><i className="fas fa-vial" /><span><b>建议样本</b>{service.samples}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal"><div><span className="eyebrow dark">BIOMARKER PANEL</span><h2>伴随诊断与重点指标</h2></div><p>指标需要结合检测范围、样本质量、疾病类型与临床背景进行综合解释。</p></div>
          <div className="biomarker-grid motion-stagger">{biomarkers.map(([code, name, text], index) => <article key={code}><small>MARKER 0{index + 1}</small><b>{code}</b><h3>{name}</h3><p>{text}</p><i /></article>)}</div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="site-container">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">ROUTE FINDER</span><h2>服务路线选择器</h2><p>选择当前场景，快速查看建议讨论的技术组合。结果仅用于前期方案沟通。</p></div>
          <div className="route-finder">
            {[
              { label: "疾病阶段", value: stage, setter: setStage, items: ["早期风险筛查", "确诊与分型", "晚期治疗决策"] },
              { label: "可用样本", value: sample, setter: setSample, items: ["组织 + 配对血液", "仅肿瘤组织", "连续血液样本"] },
              { label: "核心目的", value: goal, setter: setGoal, items: ["寻找治疗相关变异", "评估免疫标志物", "复发与疗效监测"] },
            ].map((group, index) => <div className="route-question motion-reveal" key={group.label}><small>STEP 0{index + 1}</small><h3>{group.label}</h3>{group.items.map((item) => <button type="button" className={group.value === item ? "is-active" : ""} onClick={() => group.setter(item)} key={item}>{item}<i className="fas fa-check" /></button>)}</div>)}
            <div className="route-result motion-reveal"><MotionIcon variant="network" /><small>SUGGESTED ROUTE</small><h3>{recommendation}</h3><p>提交咨询后，由技术团队结合癌种、样本质量和研究设计进一步确认。</p><Link className="consult-round-link" to={`/contact?service=${encodeURIComponent(recommendation)}#consultation-form`}><span>咨询此方案</span><i className="fas fa-arrow-right" /></Link></div>
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="site-container analysis-explorer">
          <div className="motion-reveal"><span className="eyebrow">ANALYSIS & REVIEW</span><h2>从样本到正式报告</h2><p>点击步骤查看项目、计算、审核和证据交付如何衔接。</p>
            <div className="analysis-steps">{analysisSteps.map(([title], index) => <button type="button" className={activeAnalysis === index ? "is-active" : ""} onClick={() => setActiveAnalysis(index)} key={title}><b>0{index + 1}</b><span>{title}</span></button>)}</div>
          </div>
          <div className="analysis-detail motion-reveal" key={activeAnalysis}><MotionIcon variant={(["microscope", "report", "cloud", "scan", "shield"] as MotionVariant[])[activeAnalysis]} /><small>WORKFLOW 0{activeAnalysis + 1}</small><h3>{analysisSteps[activeAnalysis][0]}</h3><p>{analysisSteps[activeAnalysis][1]}</p><div className="analysis-status"><i />PROCESS TRACEABLE</div></div>
        </div>
      </section>

      <section className="section section-tint">
        <div className="site-container faq-layout">
          <div className="motion-reveal"><span className="eyebrow">SERVICE FAQ</span><h2>项目开始前常见问题</h2><p>点击问题展开或收起说明。</p></div>
          <div className="faq-list motion-stagger">{serviceFaq.map(([question, answer], index) => <article className={openFaq === index ? "is-open" : ""} key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><i className="fas fa-plus" /></button><div><p>{answer}</p></div></article>)}</div>
        </div>
      </section>
      <Cta title="需要更具体的检测组合？" text="告诉我们疾病阶段、样本类型和项目目标，技术团队会协助完成方案评估。" />
    </AnimatedPage>
  );
};

const productItems = [
  {
    id: "screen", title: "肿瘤早筛早检", icon: "target" as MotionVariant, color: "#accbee", tech: ["甲基化", "多组学"],
    text: "针对多癌种的早期风险研究，通过表观遗传和多组学信号识别早期变化。",
    scene: "高风险队列、健康管理研究、早期标志物验证", sample: "血液及研究方案规定样本", output: "风险信号、模型分层、关键特征和研究报告",
  },
  {
    id: "diagnosis", title: "肿瘤伴随诊断", icon: "microscope" as MotionVariant, color: "#e7d9ce", tech: ["WES", "Panel", "RNA"],
    text: "通过配对 WES、深度 Panel 和 RNA 分析整理治疗相关分子信息。",
    scene: "治疗方案讨论、重要靶点检测、免疫标志物评估", sample: "肿瘤组织与配对正常样本", output: "变异总表、证据分级、IGV 证据和中文报告",
  },
  {
    id: "monitor", title: "肿瘤复发监控", icon: "scan" as MotionVariant, color: "#b3d8b6", tech: ["Panel", "多组学"],
    text: "围绕基线变异和连续样本开展动态追踪，观察治疗后信号变化。",
    scene: "术后随访、疗效观察、复发风险研究", sample: "基线组织与多个时间点血液", output: "重点位点趋势、样本对比、随访数据和更新报告",
  },
];

const matrixItems = [
  { phase: "早筛", title: "甲基化风险信号", tech: ["甲基化", "多组学"], desc: "面向早期标志物和队列风险分层。" },
  { phase: "确诊", title: "肿瘤—正常配对 WES", tech: ["WES"], desc: "建立较完整的体细胞变异图谱。" },
  { phase: "治疗", title: "高深度靶向 Panel", tech: ["Panel"], desc: "聚焦治疗相关基因与重点区域。" },
  { phase: "治疗", title: "表达与融合检测", tech: ["RNA"], desc: "补充表达、剪接和融合层面的证据。" },
  { phase: "随访", title: "重点位点动态追踪", tech: ["Panel"], desc: "对基线结果进行连续时间点观察。" },
  { phase: "研究", title: "多组学联合分析", tech: ["多组学", "WES", "RNA"], desc: "连接基因、表达、甲基化和临床信息。" },
];

const productProcess = [
  ["样本采集与配对", "确认样本编号、患者关联、肿瘤—正常配对和采样时间。"],
  ["GRCh38 标准化分析", "统一参考版本与分析流程，记录软件、参数和质量指标。"],
  ["智能变异筛选", "结合固定规则、分析员参数和临床证据形成最终结果集。"],
  ["中文报告与证据", "交付在线报告、PDF、结构化结果表和 IGV 证据查看。"],
];

export const ProductsPage: React.FC = () => {
  const [activeProduct, setActiveProduct] = useState<number | null>(0);
  const [filter, setFilter] = useState("全部");
  const [activeProcess, setActiveProcess] = useState(0);
  const visibleMatrix = matrixItems.filter((item) => filter === "全部" || item.tech.includes(filter));

  return (
    <AnimatedPage className="products-public-page">
      <PageHero eyebrow="PRECISION MEDICINE" title={<>癌症全周期<br /><span>产品解决方案</span></>} text="围绕早筛、伴随诊断与复发监控搭建可扩展产品体系，后续新增产品可直接纳入统一详情和技术矩阵。">
        <div className="hero-actions"><Link className="button button-primary" to="/contact#consultation-form">了解产品详情</Link><a className="button button-ghost" href="#products">探索产品</a></div>
      </PageHero>

      <section className="section section-tint anchor-section" id="products">
        <div className="site-container">
          <div className="section-heading centered motion-reveal"><span className="eyebrow">PRODUCT PORTFOLIO</span><h2>全方位肿瘤诊疗体系</h2><p>点击产品卡片展开详细信息，再次点击即可收起。</p></div>
          <div className="product-grid motion-stagger">
            {productItems.map((item, index) => <button type="button" className={`product-card interactive-card ${activeProduct === index ? "is-active" : ""}`} onClick={() => setActiveProduct(activeProduct === index ? null : index)} aria-expanded={activeProduct === index} key={item.id}><div className="product-icon" style={{ background: item.color }}><MotionIcon variant={item.icon} /></div><h3>{item.title}</h3><p>{item.text}</p><span>{activeProduct === index ? "收起服务详情" : "查看服务详情"} <i className={`fas fa-chevron-${activeProduct === index ? "up" : "down"}`} /></span><div className="card-scan-line" /></button>)}
          </div>
          <div className={`product-detail-drawer ${activeProduct !== null ? "is-open" : ""}`}>
            {activeProduct !== null && <div className="product-detail-inner" key={productItems[activeProduct].id}><div><small>SERVICE DETAIL · 0{activeProduct + 1}</small><h3>{productItems[activeProduct].title}</h3><p>{productItems[activeProduct].text}</p></div><dl><div><dt>适用场景</dt><dd>{productItems[activeProduct].scene}</dd></div><div><dt>建议样本</dt><dd>{productItems[activeProduct].sample}</dd></div><div><dt>主要交付</dt><dd>{productItems[activeProduct].output}</dd></div></dl><Link className="consult-round-link" to={`/contact?service=${encodeURIComponent(productItems[activeProduct].title)}#consultation-form`}><span>咨询此方案</span><i className="fas fa-arrow-right" /></Link></div>}
          </div>
        </div>
      </section>

      <section className="section section-light">
        <div className="site-container">
          <div className="section-heading split-heading motion-reveal"><div><span className="eyebrow">CAPABILITY MATRIX</span><h2>产品与技术矩阵</h2></div><p>按技术平台筛选，查看它们在不同疾病阶段承担的作用。</p></div>
          <div className="matrix-filters motion-reveal">{["全部", "WES", "Panel", "RNA", "甲基化", "多组学"].map((item) => <button type="button" onClick={() => setFilter(item)} className={filter === item ? "is-active" : ""} key={item}>{item}</button>)}</div>
          <div className="product-matrix motion-stagger" key={filter}>{visibleMatrix.map((item, index) => <article key={`${item.phase}-${item.title}`}><small>{item.phase} · 0{index + 1}</small><h3>{item.title}</h3><p>{item.desc}</p><div>{item.tech.map((tag) => <span key={tag}>{tag}</span>)}</div></article>)}</div>
        </div>
      </section>

      <section className="section section-dark">
        <div className="site-container process-explorer">
          <div className="motion-reveal"><span className="eyebrow dark">STREAMLINED WORKFLOW</span><h2>卓越的临床检测流程</h2><p>选择流程步骤，查看对应的质量控制和数据交付内容。</p>
            <div className="process-step-buttons">{productProcess.map(([title], index) => <button type="button" className={activeProcess === index ? "is-active" : ""} onClick={() => setActiveProcess(index)} key={title}><b>{index + 1}</b><span>{title}</span></button>)}</div>
          </div>
          <div className="process-detail" key={activeProcess}><MotionIcon variant={(["microscope", "network", "scan", "report"] as MotionVariant[])[activeProcess]} /><small>PROCESS 0{activeProcess + 1}</small><h3>{productProcess[activeProcess][0]}</h3><p>{productProcess[activeProcess][1]}</p><div className="process-wave"><i /><i /><i /><i /><i /></div></div>
        </div>
      </section>
      <Cta title="没有看到完全匹配的产品？" text="产品体系会持续扩展，也可根据研究目的组合 WES、Panel、RNA 与甲基化技术。" />
    </AnimatedPage>
  );
};

const consultTypes = [
  { name: "科研合作", icon: "microscope" as MotionVariant, intro: "适合队列研究、课题设计和多组学项目。", details: ["研究目标与分组", "样本类型与规模", "分析与交付要求"] },
  { name: "检测产品", icon: "target" as MotionVariant, intro: "了解早筛、伴随诊断和复发监控方案。", details: ["疾病阶段", "可用样本", "关注指标"] },
  { name: "私有化部署", icon: "cloud" as MotionVariant, intro: "规划本地 Linux 计算、云端管理和内网访问。", details: ["节点与存储", "用户与权限", "运行与同步"] },
  { name: "加入我们", icon: "network" as MotionVariant, intro: "与实验、生信、医学和产品团队共同成长。", details: ["目标岗位", "专业经历", "作品或项目"] },
];

const careers = [
  { title: "研发中心", brief: "实验技术、医学研发、项目管理", detail: "负责检测方案建立、实验流程优化、医学证据整理和跨团队项目推进。", skills: ["分子生物学", "实验设计", "医学研究"] },
  { title: "生信算法", brief: "分析流程、算法研发、平台工程", detail: "建设可复现的组学流程、变异分析算法和连接本地计算与云端管理的平台。", skills: ["Python / R", "NGS", "Linux"] },
  { title: "临床与运营", brief: "医学支持、客户成功、合规运营", detail: "理解项目需求、跟进交付质量，并协助建立清晰、可信赖的服务体验。", skills: ["医学沟通", "项目运营", "质量意识"] },
];

const contactFaq = [
  ["样本如何寄送？", "技术顾问会依据检测方案提供样本类型、保存条件、运输方式和标识规范。"],
  ["项目周期如何确定？", "周期取决于样本数量、检测类型、数据规模和分析模块，方案确认后会提供预计时间表。"],
  ["数据如何保护？", "通过角色权限、访问记录、受控下载和本地/云端分层存储降低不必要的数据暴露。"],
  ["报告如何获取？", "报告发布后，关联用户可在导航栏“个人报告”中查看；下载和查看操作会保留记录。"],
];

export const ContactPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedService = searchParams.get("service") || "";
  const [consultType, setConsultType] = useState(requestedService ? 1 : 0);
  const [openCareer, setOpenCareer] = useState<number | null>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const selected = consultTypes[consultType];

  return (
    <AnimatedPage className="contact-public-page">
      <PageHero eyebrow="CONNECT WITH US" title="联系我们 / 加入我们" text="无论是检测项目、科研合作、平台部署还是职业选择，都可以从这里找到对应的沟通入口。">
        <div className="hero-actions"><a className="button button-primary" href="#consultation-form">发起咨询</a><a className="button button-ghost" href="#careers">查看职位</a></div>
      </PageHero>

      <section className="section section-light anchor-section" id="consultation-form">
        <div className="site-container contact-intro motion-reveal"><span className="eyebrow">CONTACT INFORMATION</span><h2>选择您想讨论的方向</h2><p>不同类型的咨询会展示对应的信息准备建议，帮助双方更快进入有效沟通。</p></div>
        <div className="site-container contact-type-tabs motion-stagger">{consultTypes.map((item, index) => <button type="button" className={consultType === index ? "is-active" : ""} onClick={() => setConsultType(index)} key={item.name}><MotionIcon variant={item.icon} /><span><b>{item.name}</b><small>{item.intro}</small></span></button>)}</div>
        <div className="site-container contact-grid enhanced-contact-grid">
          <div className="contact-direction motion-reveal" key={selected.name}><MotionIcon variant={selected.icon} /><small>SELECTED DIRECTION</small><h3>{selected.name}</h3><p>{selected.intro}</p><b>建议提前准备</b>{selected.details.map((item) => <span key={item}><i className="fas fa-check" />{item}</span>)}
            <div className="contact-lines"><p><i className="fas fa-map-marker-alt" /><span><b>公司地址</b>杭州市西湖区科创园 12–15 层</span></p><a href="mailto:contact@gomics.com.cn"><i className="fas fa-envelope" /><span><b>商务合作</b>contact@gomics.com.cn</span></a><a href="tel:4000000000"><i className="fas fa-phone" /><span><b>服务热线</b>400-XXXX-XXXX · 工作日 9:00–18:00</span></a></div>
          </div>
          <form className="consult-form motion-reveal" onSubmit={(event) => event.preventDefault()}>
            <div className="form-tech-icon"><MotionIcon variant="network" /></div><small>RESPONSE WITHIN 1 BUSINESS DAY</small><h3>发送{selected.name}咨询</h3>
            <div className="form-row"><input aria-label="姓名" placeholder="您的姓名" /><input type="email" aria-label="电子邮箱" placeholder="电子邮箱" /></div>
            <select aria-label="咨询类型" value={selected.name} onChange={(event) => setConsultType(Math.max(0, consultTypes.findIndex((item) => item.name === event.target.value)))}>{consultTypes.map((item) => <option key={item.name}>{item.name}</option>)}</select>
            {selected.name === "检测产品" && <select aria-label="产品方向" defaultValue=""><option value="" disabled>请选择产品方向</option><option>肿瘤早筛</option><option>伴随诊断</option><option>复发监控</option><option>组合方案</option></select>}
            <textarea aria-label="咨询内容" defaultValue={requestedService ? `咨询方案：${requestedService}\n` : undefined} placeholder={`请描述${selected.details.join("、")}等信息…`} rows={6} /><button className="button button-primary" type="submit">提交咨询</button>
          </form>
        </div>
      </section>

      <section className="section section-tint anchor-section" id="careers">
        <div className="site-container"><div className="section-heading centered motion-reveal"><span className="eyebrow">CAREERS AT GOMICS</span><h2>加入我们的创新旅程</h2><p>点击岗位方向查看工作内容与能力关键词。</p></div>
          <div className="career-grid motion-stagger">{careers.map((item, index) => <article className={`career-expand-card ${openCareer === index ? "is-open" : ""}`} key={item.title}><MotionIcon variant={(["microscope", "network", "report"] as MotionVariant[])[index]} /><h3>{item.title}</h3><p>{item.brief}</p><button type="button" className="button button-outline" aria-expanded={openCareer === index} onClick={() => setOpenCareer(openCareer === index ? null : index)}>{openCareer === index ? "收起职位" : "查看职位"}</button><div className="career-extra"><p>{item.detail}</p><div>{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><a href="mailto:hr@gomics.com.cn">发送简历 <i className="fas fa-arrow-right" /></a></div><div className="card-scan-line" /></article>)}</div>
        </div>
      </section>

      <section className="section section-light">
        <div className="site-container faq-layout"><div className="motion-reveal"><span className="eyebrow">FREQUENTLY ASKED</span><h2>咨询前常见问题</h2><p>关于样本、周期、数据安全与报告获取。</p></div>
          <div className="faq-list motion-stagger">{contactFaq.map(([question, answer], index) => <article className={openFaq === index ? "is-open" : ""} key={question}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><i className="fas fa-plus" /></button><div><p>{answer}</p></div></article>)}</div>
        </div>
      </section>
    </AnimatedPage>
  );
};
