import React, { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const usePublicMotion = (dependency?: unknown) => {
  const scope = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      root.querySelectorAll<HTMLElement>(".motion-reveal, .motion-stagger > *").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.from(".motion-hero > *", {
        opacity: 0,
        y: 34,
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.12,
      });

      gsap.utils.toArray<HTMLElement>(".motion-reveal").forEach((element) => {
        const timelineOffset = element.classList.contains("journey-left")
          ? -72
          : element.classList.contains("journey-right")
            ? 72
            : 0;
        gsap.fromTo(element, { opacity: 0, y: timelineOffset ? 0 : 58, x: timelineOffset }, {
          opacity: 1,
          y: 0,
          x: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 84%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>(".motion-stagger").forEach((group) => {
        gsap.fromTo(Array.from(group.children), { opacity: 0, y: 46 }, {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: { trigger: group, start: "top 82%", once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>(".motion-parallax").forEach((element) => {
        gsap.fromTo(element, { yPercent: -5 }, {
          yPercent: 7,
          ease: "none",
          scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: 1.2 },
        });
      });

      gsap.utils.toArray<HTMLElement>("[data-count]").forEach((element) => {
        const target = Number(element.dataset.count || 0);
        const suffix = element.dataset.suffix || "";
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: "power2.out",
          scrollTrigger: { trigger: element, start: "top 90%", once: true },
          onUpdate: () => { element.textContent = `${Math.round(counter.value).toLocaleString()}${suffix}`; },
        });
      });

      gsap.to(".svg-orbit", { rotate: 360, transformOrigin: "50% 50%", duration: 22, repeat: -1, ease: "none" });
      gsap.to(".svg-orbit-reverse", { rotate: -360, transformOrigin: "50% 50%", duration: 16, repeat: -1, ease: "none" });
      gsap.to(".ambient-float", { y: -14, duration: 3.2, repeat: -1, yoyo: true, ease: "sine.inOut", stagger: 0.4 });
    }, scope);

    return () => ctx.revert();
  }, [dependency]);

  return scope;
};

export const AnimatedPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
  const ref = usePublicMotion();
  return <div ref={ref} className={`public-page animated-public-page ${className}`}>{children}</div>;
};

type IconVariant = "dna" | "scan" | "network" | "cloud" | "report" | "shield" | "microscope" | "target";

export const MotionIcon: React.FC<{ variant: IconVariant; className?: string }> = ({ variant, className = "" }) => {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <span className={`motion-icon motion-icon-${variant} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        {variant === "dna" && <>
          <path {...common} className="svg-draw" d="M18 8c20 8 20 40 0 48M46 8c-20 8-20 40 0 48" />
          <path {...common} className="svg-pulse" d="M20 15h24M17 25h30M17 39h30M20 49h24" />
        </>}
        {variant === "scan" && <>
          <rect {...common} className="svg-draw" x="11" y="11" width="42" height="42" rx="9" />
          <path {...common} d="M18 32h8l4-9 6 18 4-9h7" />
          <path {...common} className="svg-scan" d="M15 19h34" />
        </>}
        {variant === "network" && <>
          <circle {...common} cx="32" cy="13" r="6" /><circle {...common} cx="15" cy="45" r="6" /><circle {...common} cx="49" cy="45" r="6" />
          <path {...common} className="svg-draw" d="M29 18 18 39M35 18l11 21M21 45h22" />
          <circle className="svg-node" cx="32" cy="28" r="2.5" fill="currentColor" />
        </>}
        {variant === "cloud" && <>
          <path {...common} className="svg-draw" d="M17 45h30a9 9 0 0 0 1-18 16 16 0 0 0-30-5 12 12 0 0 0-1 23Z" />
          <path {...common} className="svg-data-up" d="m26 38 6-6 6 6M32 32v17" />
        </>}
        {variant === "report" && <>
          <path {...common} className="svg-draw" d="M18 8h20l9 9v39H18zM38 8v10h9" />
          <path {...common} d="M24 29h16M24 36h16M24 43h10" />
          <path {...common} className="svg-check" d="m35 50 4 4 9-11" />
        </>}
        {variant === "shield" && <>
          <path {...common} className="svg-draw" d="M32 7 51 14v15c0 13-8 23-19 28C21 52 13 42 13 29V14z" />
          <path {...common} className="svg-check" d="m23 32 6 6 13-15" />
        </>}
        {variant === "microscope" && <>
          <path {...common} className="svg-draw" d="m28 10 11 11-7 7-11-11zM29 27c-8 8-7 18 0 23M18 50h30M37 23l5 5M41 28c7 8 2 18-7 18h-5" />
          <circle className="svg-node" cx="23" cy="38" r="3" fill="currentColor" />
        </>}
        {variant === "target" && <>
          <circle {...common} className="svg-orbit" cx="32" cy="32" r="22" strokeDasharray="18 8" />
          <circle {...common} className="svg-orbit-reverse" cx="32" cy="32" r="13" strokeDasharray="8 6" />
          <circle className="svg-node" cx="32" cy="32" r="4" fill="currentColor" />
          <path {...common} className="svg-scan" d="M32 5v54M5 32h54" opacity=".35" />
        </>}
      </svg>
    </span>
  );
};
