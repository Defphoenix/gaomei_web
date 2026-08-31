import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import gsap from "gsap";
import { Observer } from "gsap/Observer";
import { MotionIcon } from "../components/PublicMotion";
import {
  DEFAULT_PRODUCT_SLUG,
  PRODUCTS,
  formatPrice,
  getProduct,
  getProductIndex,
} from "../content/productsCatalog";

gsap.registerPlugin(Observer);

const ProductsPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  if (!slug) return <Navigate to={`/products/${DEFAULT_PRODUCT_SLUG}`} replace />;
  if (!PRODUCTS.some((p) => p.slug === slug)) {
    return <Navigate to={`/products/${DEFAULT_PRODUCT_SLUG}`} replace />;
  }
  return <ProductsExperience slug={slug} />;
};

const ProductsExperience: React.FC<{ slug: string }> = ({ slug }) => {
  const navigate = useNavigate();
  const index = getProductIndex(slug);
  const product = getProduct(slug);
  const [animating, setAnimating] = useState(false);
  const [railHot, setRailHot] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const stageRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const railItemsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dirRef = useRef(1);
  const indexRef = useRef(index);
  const animatingRef = useRef(false);

  indexRef.current = index;
  animatingRef.current = animating;

  const goTo = (next: number, dir = 1) => {
    if (animatingRef.current) return;
    const clamped = (next + PRODUCTS.length) % PRODUCTS.length;
    if (clamped === indexRef.current) return;
    dirRef.current = dir;
    navigate(`/products/${PRODUCTS[clamped].slug}`);
  };

  const consultHref = `/contact?service=${encodeURIComponent(product.title)}#consultation-form`;

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (reduce || noHover) return;

    const items = () => railItemsRef.current.filter((el): el is HTMLButtonElement => !!el);
    const radius = 110;

    const reset = () => {
      setRailHot(false);
      gsap.to(items(), {
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onMove = (event: PointerEvent) => {
      setRailHot(true);
      items().forEach((el) => {
        const rect = el.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const dist = Math.hypot(dx, dy);
        const t = gsap.utils.clamp(0, 1, 1 - dist / radius);
        gsap.to(el, {
          scale: 1 + t * 0.85,
          duration: 0.18,
          ease: "power2.out",
          overwrite: "auto",
        });
      });
    };

    const onEnter = () => setRailHot(true);
    rail.addEventListener("pointerenter", onEnter);
    rail.addEventListener("pointermove", onMove);
    rail.addEventListener("pointerleave", reset);
    return () => {
      rail.removeEventListener("pointerenter", onEnter);
      rail.removeEventListener("pointermove", onMove);
      rail.removeEventListener("pointerleave", reset);
      gsap.killTweensOf(items());
      gsap.set(items(), { clearProps: "transform" });
    };
  }, []);

  useLayoutEffect(() => {
    const progress = progressRef.current;
    const rail = railRef.current;
    if (!progress || !rail) return;
    gsap.to(progress, {
      width: `${((index + 1) / PRODUCTS.length) * 100}%`,
      duration: 0.5,
      ease: "power3.out",
      overwrite: "auto",
    });
    rail.style.setProperty("--rail-thumb", `${((index + 0.5) / PRODUCTS.length) * 100}%`);
    railItemsRef.current[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setAnimating(true);
    const dir = dirRef.current;
    const tl = gsap.timeline({ onComplete: () => setAnimating(false) });
    tl.fromTo(
      panel,
      { xPercent: dir * 22, opacity: 0, filter: "blur(5px)" },
      { xPercent: 0, opacity: 1, filter: "blur(0px)", duration: 0.65, ease: "power3.out" },
    );
    return () => { tl.kill(); };
  }, [slug]);

  useEffect(() => {
    if (!qrOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setQrOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qrOpen]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let cooldown = false;
    const observer = Observer.create({
      target: stage,
      type: "wheel,touch",
      wheelSpeed: -1,
      tolerance: 14,
      preventDefault: true,
      ignore: ".products-qr-modal, .products-cta, .products-rail",
      onDown: () => {
        if (qrOpen || cooldown || animatingRef.current) return;
        cooldown = true;
        goTo(indexRef.current - 1, -1);
        window.setTimeout(() => { cooldown = false; }, 700);
      },
      onUp: () => {
        if (qrOpen || cooldown || animatingRef.current) return;
        cooldown = true;
        goTo(indexRef.current + 1, 1);
        window.setTimeout(() => { cooldown = false; }, 700);
      },
    });
    return () => observer.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, qrOpen]);

  const isFree = product.price <= 0;

  return (
    <section
      ref={stageRef}
      className="products-stage"
      style={{ ["--product-accent" as string]: product.accent }}
      aria-label="产品方案切换"
    >
      <div className="products-stage-bg" />

      <div className="products-rail-wrap">
        <div className={`products-rail ${railHot ? "is-hot" : ""}`} ref={railRef}>
          {PRODUCTS.map((item, i) => (
            <button
              type="button"
              key={item.slug}
              className={`products-rail-item ${i === index ? "is-active" : ""}`}
              ref={(el) => { railItemsRef.current[i] = el; }}
              onClick={() => {
                if (i === index) return;
                dirRef.current = i > index ? 1 : -1;
                goTo(i, i > index ? 1 : -1);
              }}
              aria-current={i === index ? "page" : undefined}
              aria-label={item.title}
              title={item.short}
            >
              <span className="products-rail-icon" style={{ background: `${item.accent}22` }}>
                <MotionIcon variant={item.icon} />
              </span>
              <span className="products-rail-label">{item.short}</span>
            </button>
          ))}
        </div>
        <div className="products-rail-track" aria-hidden="true">
          <div className="products-rail-progress" ref={progressRef} />
          <i className="products-rail-thumb" />
        </div>
      </div>

      <div className="products-panel" ref={panelRef} key={slug}>
        <div className="products-visual">
          <div className="products-visual-stage">
            <div className="products-visual-aura" />
            <img className="products-kit" src={product.image} alt={product.title} />
            <div className="products-visual-meta">
              <small>0{index + 1} / 0{PRODUCTS.length}</small>
              <strong>{product.subtitle}</strong>
            </div>
          </div>
        </div>

        <div className="products-copy">
          <div className="products-tags">
            {product.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          <h1>{product.title}</h1>
          <p className="products-intro">{product.intro}</p>

          <div className={`products-price ${isFree ? "is-free" : ""}`}>
            <div className="products-price-now">
              <em>{isFree ? "公益价" : "活动价"}</em>
              <strong>{formatPrice(product.price)}</strong>
            </div>
            {!!product.priceOriginal && product.priceOriginal > product.price && (
              <span className="products-price-old">原价 {formatPrice(product.priceOriginal)}</span>
            )}
            {product.priceNote && <span className="products-price-note">{product.priceNote}</span>}
          </div>

          <ul className="products-highlights">
            {product.highlights.slice(0, 3).map((line) => (
              <li key={line}><i className="fas fa-check" />{line}</li>
            ))}
          </ul>

          <div className="products-purchase">
            <div className="products-cta-row">
              <Link className="products-cta products-cta-primary" to={consultHref}>
                {isFree ? "立即申请公益名额" : "立即咨询 / 购买"}
                <i className="fas fa-arrow-right" />
              </Link>
              <button
                type="button"
                className="products-cta products-cta-secondary"
                onClick={() => setQrOpen(true)}
              >
                扫码下单
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="products-wheel-hint" aria-hidden="true">
        <span>SCROLL</span>
        <i />
      </div>

      {qrOpen && (
        <div
          className="products-qr-modal"
          role="dialog"
          aria-modal="true"
          aria-label={product.qrLabel}
          onClick={() => setQrOpen(false)}
        >
          <div className="products-qr-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="products-qr-close" aria-label="关闭" onClick={() => setQrOpen(false)}>
              <i className="fas fa-times" />
            </button>
            <img src={product.qr} alt={product.qrLabel} />
            <strong>{product.title}</strong>
            <p>{product.qrLabel}</p>
            <span>微信扫一扫即可咨询或下单</span>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProductsPage;
