import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import api from "../api/client";
import { phoneLabel, phoneTelHref } from "../content/siteContact";
import "./contact-float.css";

const ContactFloat: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [hotlineRaw, setHotlineRaw] = useState("");
  const [productName, setProductName] = useState("");
  const [name, setName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotline = phoneLabel(hotlineRaw);
  const telHref = phoneTelHref(hotlineRaw);

  const startNudge = useCallback(() => {
    setNudge(true);
    window.setTimeout(() => setNudge(false), 4200);
  }, []);

  useEffect(() => {
    api.get("/company/info/").then((res) => setHotlineRaw(res.data?.phone || "")).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (searchParams.get("support") !== "interpret") return;

    const product = searchParams.get("product") || "";
    setProductName(product);
    setOpen(true);
    startNudge();

    const next = new URLSearchParams(searchParams);
    next.delete("support");
    next.delete("product");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, startNudge]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setOk(null);
    setErr(null);
    try {
      const res = await api.post("/company/messages/", {
        name: name.trim(),
        phone: visitorPhone.trim(),
        category: "interpret",
        product: productName,
        content: productName
          ? `预约产品解读：${productName}`
          : "预约产品解读",
      });
      setOk(res.data?.detail || "预约已提交，我们将尽快电话联系您。");
      setName("");
      setVisitorPhone("");
    } catch {
      setErr("提交失败，请直接拨打电话咨询。");
    } finally {
      setBusy(false);
    }
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    startNudge();
  };

  return (
    <div className={`cf-float ${open ? "is-open" : ""}`} ref={panelRef}>
      {open && (
        <div className="cf-panel" role="dialog" aria-label="在线客服">
          <header>
            <strong>在线客服</strong>
            <button type="button" aria-label="关闭" onClick={() => setOpen(false)}>
              <i className="fas fa-times" />
            </button>
          </header>
          <p className="cf-lead">预约产品解读 · 留下姓名与手机号，顾问将电话联系您。</p>
          {productName && (
            <p className="cf-product-tag">咨询产品：{productName}</p>
          )}
          {nudge && (
            <div className="cf-nudge-tip" role="status">
              <i className="fas fa-hand-point-down" /> 请填写姓名与手机号
            </div>
          )}
          <form className={`cf-form ${nudge ? "is-nudge" : ""}`} onSubmit={onSubmit}>
            <label>
              <span>姓名</span>
              <input
                className="cf-nudge-target"
                placeholder="请输入您的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label>
              <span>手机号</span>
              <input
                className="cf-nudge-target"
                placeholder="请输入手机号"
                value={visitorPhone}
                onChange={(e) => setVisitorPhone(e.target.value)}
                required
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "提交中…" : "预约解读"}
            </button>
            {ok && <em className="ok">{ok}</em>}
            {err && <em className="err">{err}</em>}
          </form>
          <div className="cf-qr">
            <img src="/assets/images/wechat_qrcode.jpg" alt="高美基因微信二维码" />
            <span>微信扫一扫咨询</span>
          </div>
          <div className="cf-foot-links">
            <a href={telHref}><i className="fas fa-phone" /> {hotline}</a>
            <Link to="/contact?intent=consult#consultation-form" onClick={() => setOpen(false)}>
              更多留言
            </Link>
          </div>
          <small>浙江高美基因科技有限公司</small>
        </div>
      )}
      <button
        type="button"
        className="cf-launcher"
        aria-expanded={open}
        aria-label={open ? "关闭客服" : "联系在线客服"}
        onClick={toggleOpen}
      >
        <i className={`fas ${open ? "fa-times" : "fa-comments"}`} />
        <span>{open ? "关闭" : "在线客服"}</span>
      </button>
    </div>
  );
};

export default ContactFloat;
