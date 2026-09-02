import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatedPage, MotionIcon } from "../components/PublicMotion";
import api from "../api/client";
import {
  categoryFromConsultName,
  phoneLabel,
  phoneTelHref,
} from "../content/siteContact";
import type { CompanyInfo } from "../types";

type MotionVariant = React.ComponentProps<typeof MotionIcon>["variant"];

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
