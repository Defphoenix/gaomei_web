import React, { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import "./PartnerLogoMarquee.css";

const PARTNER_LOGOS = Array.from(
  { length: 12 },
  (_, i) => `/assets/images/partners/h_${String(i).padStart(2, "0")}.webp`,
);

const PartnerLogoMarquee: React.FC = () => {
  const trackRef = useRef<HTMLDivElement>(null);
  const logos = useMemo(() => [...PARTNER_LOGOS, ...PARTNER_LOGOS], []);

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
        duration: Math.max(28, total / 40),
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
    <section className="partner-marquee-section" aria-label="科研合作单位">
      <div className="site-container partner-marquee-head">
        <span className="eyebrow">RESEARCH PARTNERS</span>
        <h2>科研合作单位</h2>
        <p>严肃医疗全国 37 家三甲医院 · 数十家健康管理机构及民营医院</p>
      </div>
      <div className="partner-marquee">
        <div className="partner-marquee-track" ref={trackRef}>
          {logos.map((src, i) => (
            <img
              className="partner-logo-image"
              src={src}
              alt="合作单位"
              loading="eager"
              key={`${src}-${i}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PartnerLogoMarquee;
