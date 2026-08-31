import React, { useLayoutEffect, useRef } from "react";
import { Link, type LinkProps } from "react-router-dom";
import gsap from "gsap";

type MagneticButtonProps = LinkProps & {
  strength?: number;
  textStrength?: number;
};

/**
 * GSAP Magnetic Button with overwrite: "auto" —
 * pull tweens and spring-back share x/y; "auto" only kills overlapping props.
 */
const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = "",
  strength = 0.35,
  textStrength = 0.18,
  ...linkProps
}) => {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const button = rootRef.current;
    const text = textRef.current;
    if (!button || !text) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    const onMove = (event: MouseEvent) => {
      const rect = button.getBoundingClientRect();
      const x = event.clientX - (rect.left + rect.width / 2);
      const y = event.clientY - (rect.top + rect.height / 2);

      gsap.to(button, {
        x: x * strength,
        y: y * strength,
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
      gsap.to(text, {
        x: x * textStrength,
        y: y * textStrength,
        duration: 0.35,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    const onLeave = () => {
      gsap.to(button, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.35)",
        overwrite: "auto",
      });
      gsap.to(text, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.35)",
        overwrite: "auto",
      });
    };

    button.addEventListener("mousemove", onMove);
    button.addEventListener("mouseleave", onLeave);
    return () => {
      button.removeEventListener("mousemove", onMove);
      button.removeEventListener("mouseleave", onLeave);
      gsap.killTweensOf([button, text]);
      gsap.set([button, text], { clearProps: "transform" });
    };
  }, [strength, textStrength]);

  return (
    <Link ref={rootRef} className={`magnetic-button ${className}`.trim()} {...linkProps}>
      <span ref={textRef} className="magnetic-button-label">
        {children}
      </span>
    </Link>
  );
};

export default MagneticButton;
