import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { TECH_CATEGORIES } from "../content/techCatalog";

type Props = {
  active?: boolean;
  onNavigate?: () => void;
};

const HEADER_H = 74;

const TechMegaMenu: React.FC<Props> = ({ active, onNavigate }) => {
  const location = useLocation();
  const onTechSection = location.pathname === "/tech" || location.pathname.startsWith("/tech/");
  const [open, setOpen] = useState(false);
  const [catIdx, setCatIdx] = useState(0);
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1051px)").matches : true,
  );
  const closeTimer = useRef<number | null>(null);
  const category = TECH_CATEGORIES[catIdx];

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1051px)");
    const sync = () => {
      setDesktop(mq.matches);
      if (!mq.matches) setOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // On /tech pages: never keep the mega menu open
  useEffect(() => {
    if (onTechSection) {
      setOpen(false);
      if (closeTimer.current != null) {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    }
  }, [onTechSection, location.pathname]);

  const clearClose = () => {
    if (closeTimer.current != null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const show = () => {
    // Only show mega menu when browsing other site sections
    if (!desktop || onTechSection) return;
    clearClose();
    setOpen(true);
  };

  const hideSoon = () => {
    clearClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearClose(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = () => {
    setOpen(false);
    onNavigate?.();
  };

  const panel =
    open && desktop && !onTechSection
      ? createPortal(
          <div
            className="tech-mega-panel"
            style={{
              top: HEADER_H,
              height: `calc(100dvh - ${HEADER_H}px)`,
            }}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
          >
            <div className="tech-mega-inner">
              <aside className="tech-mega-cats">
                <small>TECHNOLOGY PLATFORM</small>
                <h3>实验 · 计算 · AI</h3>
                {TECH_CATEGORIES.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={catIdx === i ? "is-active" : ""}
                    onMouseEnter={() => setCatIdx(i)}
                    onFocus={() => setCatIdx(i)}
                  >
                    <b>{c.title}</b>
                    <span>{c.brief}</span>
                  </button>
                ))}
                <Link className="tech-mega-all" to="/tech" onClick={go}>
                  查看技术平台总览 <i className="fas fa-arrow-right" />
                </Link>
              </aside>
              <div className="tech-mega-links">
                <header>
                  <span>{category.title}</span>
                  <p>{category.brief}</p>
                </header>
                <div className="tech-mega-grid">
                  {category.links.map((link) => (
                    <Link key={link.slug} to={`/tech/${link.slug}`} onClick={go}>
                      <b>{link.title}</b>
                      <small>{link.brief}</small>
                      <i className="fas fa-arrow-right" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`tech-mega-wrap ${open ? "is-open" : ""} ${onTechSection ? "is-on-tech" : ""}`}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
    >
      <Link
        to="/tech"
        className={`tech-mega-trigger ${active ? "active" : ""}`}
        onClick={go}
        aria-expanded={open}
        aria-haspopup={!onTechSection}
      >
        科技服务
        {!onTechSection && <i className="fas fa-chevron-down" />}
      </Link>
      {open && desktop && !onTechSection && (
        <div className="tech-mega-bridge" onMouseEnter={show} aria-hidden />
      )}
      {panel}
    </div>
  );
};

export default TechMegaMenu;
