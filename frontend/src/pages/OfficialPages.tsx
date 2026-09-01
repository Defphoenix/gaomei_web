import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";
import api from "../api/client";
import {
  categoryFromConsultName,
  phoneLabel,
  phoneTelHref,
} from "../content/siteContact";
import type { CompanyInfo } from "../types";

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
      <Link className="button button-primary" to="/contact?intent=consult#consultation-form">发起咨询</Link>
    </div>
  </section>
);

const oncologyServices = [
  {
    id: "screening", name: "肿瘤早筛", label: "EARLY DETECTION", icon: "target" as MotionVariant, image: "/assets/images/service_tumor_screening.jpg",
    intro: "通过甲基化与多组学信号识别早期风险，为研究队列和高风险人群管理提供分层依据。",
    bullets: ["风险信号识别", "多癌种研究策略", "队列级模型评估"], samples: "血液、组织及研究方案规定的其他样本",
  },
  {
    id: "therapy", name: "晚期治疗方案制定", label: "THERAPY DECISION", icon: "dna" as MotionVariant, image: "/assets/images/service_therapy_planning.jpg",
    intro: "结合肿瘤—正常配对 WES、深度 Panel 和临床证据，整理可能影响治疗选择的重要分子信息。",
    bullets: ["驱动变异与通路", "靶向治疗相关证据", "免疫相关标志物"], samples: "肿瘤组织 + 配对正常样本，必要时结合血液",
  },
  {
    id: "companion", name: "伴随诊断", label: "COMPANION DIAGNOSTICS", icon: "microscope" as MotionVariant, image: "/assets/images/service_companion_diagnostics.jpg",
    intro: "围绕明确药物或治疗路径配置重点基因、融合、拷贝数和免疫标志物分析。",
    bullets: ["MSI / TMB / HRD", "融合与扩增缺失", "重点药物相关位点"], samples: "FFPE、手术组织、活检及合格核酸",
  },
  {
    id: "monitoring", name: "复发与疗效监测", label: "LONGITUDINAL MONITORING", icon: "scan" as MotionVariant, image: "/assets/images/service_recurrence_monitoring.jpg",
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
      <PageHero eyebrow="PRECISION ONCOLOGY" title={<>肿瘤全周期<br /><span>精准检测服务</span></>} text="从 cfDNA 甲基化早筛、肿瘤突变分析到疗效监测，以五大多组学实验体系与自主算法支撑每个阶段的判断。">
        <div className="hero-actions"><Link className="button button-primary" to="/contact?intent=consult#consultation-form">发起咨询</Link><a className="button button-ghost" href="#oncology-services">查看服务体系</a></div>
      </PageHero>

      <section className="section section-light anchor-section" id="oncology-services">
        <div className="site-container">
          <div className="section-heading motion-reveal"><span className="eyebrow">ONCOLOGY SERVICES</span><h2>从风险识别到持续随访</h2><p>选择不同阶段，查看适用场景、样本策略与主要分析内容。</p></div>
          <div className="service-explorer">
            <div className="service-visual motion-reveal" style={{ backgroundImage: `linear-gradient(180deg,rgba(5,18,42,.42),rgba(5,18,42,.78) 48%,rgba(5,18,42,.94)),url('${service.image}')` }}>
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
            <div className="route-result motion-reveal"><MotionIcon variant="network" /><small>SUGGESTED ROUTE</small><h3>{recommendation}</h3><p>提交咨询后，由技术团队结合癌种、样本质量和研究设计进一步确认。</p><Link className="consult-round-link" to={`/contact?intent=consult&service=${encodeURIComponent(recommendation)}#consultation-form`}><span>咨询此方案</span><i className="fas fa-arrow-right" /></Link></div>
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedService = searchParams.get("service") || "";
  const intent = searchParams.get("intent") || "";
  const [consultType, setConsultType] = useState(requestedService ? 1 : 0);
  const [openCareer, setOpenCareer] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [product, setProduct] = useState("");
  const [content, setContent] = useState(requestedService ? `咨询方案：${requestedService}\n` : "");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [formNudge, setFormNudge] = useState(false);
  const selected = consultTypes[consultType];
  const hotline = phoneLabel(company?.phone);
  const telHref = phoneTelHref(company?.phone);

  useEffect(() => {
    api.get("/company/info/").then((res) => setCompany(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (intent === "interpret") {
      const next = new URLSearchParams();
      next.set("support", "interpret");
      if (requestedService) next.set("product", requestedService);
      navigate({ pathname: "/contact", search: `?${next.toString()}` }, { replace: true });
      return;
    }

    const hash = window.location.hash.replace("#", "");
    if (intent !== "consult" && intent !== "focus" && hash !== "consultation-form") return;

    setFormNudge(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      document.getElementById("consultation-form")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 80);
    const clear = window.setTimeout(() => setFormNudge(false), 4200);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clear);
    };
  }, [intent, requestedService, searchParams]);

  const triggerConsultNudge = () => {
    setFormNudge(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      document.getElementById("consultation-form")?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 40);
    window.setTimeout(() => setFormNudge(false), 4200);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      const res = await api.post("/company/messages/", {
        name: name.trim(),
        phone: phone.trim(),
        category: categoryFromConsultName(selected.name),
        product: selected.name === "检测产品" ? product : "",
        content: content.trim(),
      });
      setSubmitMsg(res.data?.detail || "留言已提交，我们将尽快电话联系您。");
      setName("");
      setPhone("");
      setProduct("");
      setContent("");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string; phone?: string[]; content?: string[] } } })?.response?.data;
      const msg = detail?.detail
        || detail?.phone?.[0]
        || detail?.content?.[0]
        || "提交失败，请稍后重试或直接电话咨询。";
      setSubmitErr(typeof msg === "string" ? msg : "提交失败，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedPage className="contact-public-page">
      <section className="inner-hero contact-hero-compact">
        <div className="hero-tech-lines" />
        <div className="site-container inner-hero-content motion-hero">
          <span className="eyebrow dark">CONNECT WITH US</span>
          <h1>联系我们 / 加入我们</h1>
          <p>全部方案均为电话咨询；也可留言，我们会回电。招聘请电话沟通投递安排。</p>
          <div className="hero-actions">
            <a className="button button-primary" href={telHref}><i className="fas fa-phone" /> 电话咨询 {hotline}</a>
            <a
              className="button button-ghost"
              href="#consultation-form"
              onClick={(e) => {
                e.preventDefault();
                triggerConsultNudge();
              }}
            >
              发起咨询
            </a>
          </div>
        </div>
      </section>

      <section className={`section section-light contact-section-compact anchor-section ${formNudge ? "is-form-nudge" : ""}`} id="consultation-form">
        <div className="site-container">
          <div className="contact-compact-head motion-reveal">
            <div>
              <span className="eyebrow">CONTACT</span>
              <h2>电话咨询 / 留言回电</h2>
            </div>
            <p>留下姓名与电话，管理员可在门户后台查看留言并回电。</p>
          </div>
          {formNudge && (
            <div className="interpret-nudge-tip contact-nudge-tip" role="status">
              <i className="fas fa-hand-point-down" /> 请在高亮输入框填写姓名与手机号
            </div>
          )}

          <div className="contact-type-pills motion-stagger">
            {consultTypes.map((item, index) => (
              <button
                type="button"
                className={consultType === index ? "is-active" : ""}
                onClick={() => setConsultType(index)}
                key={item.name}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="contact-compact-grid">
            <aside className="contact-side-card motion-reveal" key={selected.name}>
              <div className="contact-side-top">
                <MotionIcon variant={selected.icon} />
                <div>
                  <small>SELECTED</small>
                  <h3>{selected.name}</h3>
                </div>
              </div>
              <p>{selected.intro}</p>
              <b>建议提前准备</b>
              <ul>
                {selected.details.map((item) => (
                  <li key={item}><i className="fas fa-check" />{item}</li>
                ))}
              </ul>
              <div className="contact-side-meta">
                <p><i className="fas fa-phone" /><a href={telHref}>{hotline}</a>（电话咨询）</p>
                <p><i className="fas fa-map-marker-alt" />杭州市余杭区仓前街道留泽街110号</p>
                <p><i className="fab fa-weixin" />微信公众号：高美基因</p>
              </div>
              <div className="contact-side-actions">
                <a className="contact-call-btn" href={telHref}>
                  <i className="fas fa-phone-alt" /> 立即拨打
                </a>
                <div className="contact-wechat-inline">
                  <img src="/assets/images/wechat_qrcode.jpg" alt="高美基因微信公众号二维码" />
                  <span>扫码关注公众号</span>
                </div>
              </div>
            </aside>

            <form className={`consult-form contact-form-compact motion-reveal ${formNudge ? "is-nudge" : ""}`} onSubmit={onSubmit}>
              <small>LEAVE A MESSAGE · WE WILL CALL BACK</small>
              <h3>{selected.name} · 留言</h3>
              <div className="form-row">
                <input className="interpret-nudge-target" aria-label="姓名" placeholder="您的姓名" value={name} onChange={(e) => setName(e.target.value)} required />
                <input className="interpret-nudge-target" aria-label="联系电话" placeholder="联系电话（必填）" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <select
                aria-label="咨询类型"
                value={selected.name}
                onChange={(event) => setConsultType(Math.max(0, consultTypes.findIndex((item) => item.name === event.target.value)))}
              >
                {consultTypes.map((item) => <option key={item.name}>{item.name}</option>)}
              </select>
              <select
                aria-label="产品方向"
                className={selected.name === "检测产品" ? undefined : "is-slot-placeholder"}
                value={selected.name === "检测产品" ? product : ""}
                onChange={(e) => setProduct(e.target.value)}
                required={selected.name === "检测产品"}
                disabled={selected.name !== "检测产品"}
              >
                <option value="" disabled>
                  {selected.name === "检测产品" ? "请选择产品方向" : "产品方向（选择「检测产品」后填写）"}
                </option>
                <option>美甘鑫 · 肝癌风险评估</option>
                <option>美甘飞 · 肺癌风险评估</option>
                <option>肿瘤精准检测</option>
                <option>科研合作方案</option>
              </select>
              <textarea
                aria-label="留言内容"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`请描述${selected.details.join("、")}等信息，我们会电话联系您…`}
                rows={4}
                required
              />
              <button className="button button-primary" type="submit" disabled={submitting}>
                {submitting ? "提交中…" : "提交留言"}
              </button>
              {submitMsg && <p className="contact-form-ok">{submitMsg}</p>}
              {submitErr && <p className="contact-form-err">{submitErr}</p>}
              <p className="contact-form-hint">也可直接拨打 <a href={telHref}>{hotline}</a> 电话咨询。</p>
            </form>
          </div>
        </div>
      </section>

      <section className="section section-tint contact-section-compact anchor-section" id="careers">
        <div className="site-container">
          <div className="contact-compact-head motion-reveal">
            <div>
              <span className="eyebrow">CAREERS</span>
              <h2>加入我们</h2>
            </div>
            <p>三个方向，展开查看职责；投递与面试安排请电话咨询 {hotline}，或留言注明应聘岗位。</p>
          </div>
          <div className="career-compact-grid motion-stagger">
            {careers.map((item, index) => {
              const open = openCareer === index;
              return (
                <article className={`career-compact-card ${open ? "is-open" : ""}`} key={item.title}>
                  <button type="button" className="career-compact-toggle" aria-expanded={open} onClick={() => setOpenCareer(open ? null : index)}>
                    <MotionIcon variant={(["microscope", "network", "report"] as MotionVariant[])[index]} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.brief}</small>
                    </span>
                    <i className={`fas fa-chevron-${open ? "up" : "down"}`} />
                  </button>
                  {open && (
                    <div className="career-compact-body">
                      <p>{item.detail}</p>
                      <div>{item.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
                      <a href={telHref}>电话咨询投递 <i className="fas fa-phone" /></a>
                      <a href="#consultation-form" onClick={() => setConsultType(3)}>留言应聘意向 <i className="fas fa-arrow-right" /></a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section-light contact-section-compact contact-faq-compact">
        <div className="site-container">
          <div className="contact-compact-head motion-reveal">
            <div>
              <span className="eyebrow">FAQ</span>
              <h2>咨询前常见问题</h2>
            </div>
          </div>
          <div className="faq-list contact-faq-dense motion-stagger">
            {contactFaq.map(([question, answer], index) => (
              <article className={openFaq === index ? "is-open" : ""} key={question}>
                <button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                  <span>{question}</span>
                  <i className="fas fa-plus" />
                </button>
                <div><p>{answer}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AnimatedPage>
  );
};
