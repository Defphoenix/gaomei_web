import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";

const CERTS = Array.from({ length: 24 }, (_, i) => `/assets/images/honors/cert_${String(i).padStart(2, "0")}.png`);

const HONOR_TAGS = [
  "国家高新技术企业",
  "ISO 15189 医学实验室质量认可",
  "PCR 实验室技术审核合格",
  "16 项专利 / 15 项软件著作权",
  "研发论文 100+ 篇",
];

const HonorsCardSlider: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const cards = useMemo(() => [...CERTS, ...CERTS], []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let tween: gsap.core.Tween | null = null;
    const start = () => {
      tween?.kill();
      const total = track.scrollWidth / 2;
      if (total < 10) return;
      gsap.set(track, { x: -total });
      tween = gsap.to(track, {
        x: 0,
        duration: Math.max(40, total / 32),
        ease: "none",
        repeat: -1,
      });
    };
    const imgs = Array.from(track.querySelectorAll("img"));
    let pending = imgs.length;
    const done = () => {
      pending -= 1;
      if (pending <= 0) start();
    };
    imgs.forEach((img) => {
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
    if (!imgs.length) start();
    return () => { tween?.kill(); };
  }, []);

  return (
    <section className="section honors-section">
      <div className="site-container">
        <div className="section-heading split-heading motion-reveal">
          <div>
            <span className="eyebrow">CREDENTIALS</span>
            <h2>资质与荣誉</h2>
          </div>
          <p>国家高新技术企业、ISO 15189、PCR 实验室资质与核心专利著作权，持续构筑可信检测能力。</p>
        </div>
        <div className="honors-tags motion-stagger">
          {HONOR_TAGS.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="honors-slider">
        <div className="honors-slider-track" ref={trackRef}>
          {cards.map((src, i) => (
            <article className="honors-card" key={`${src}-${i}`}>
              <img src={src} alt="资质证书" loading="eager" />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HonorsCardSlider;
