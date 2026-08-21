import React, { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollManager: React.FC = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  const previousRoute = useRef({ pathname: location.pathname, search: location.search });

  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isSamePageFilterChange = (
      previousRoute.current.pathname === location.pathname
      && previousRoute.current.search !== location.search
      && !location.hash
    );
    const scroll = () => {
      if (isSamePageFilterChange) return;

      if (location.hash) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
          return;
        }
      }

      if (navigationType === "POP") {
        window.scrollTo({ top: positions.current.get(location.key) || 0, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };

    const frame = window.requestAnimationFrame(scroll);
    previousRoute.current = { pathname: location.pathname, search: location.search };
    return () => {
      window.cancelAnimationFrame(frame);
      positions.current.set(location.key, window.scrollY);
    };
  }, [location.hash, location.key, location.pathname, location.search, navigationType]);

  return null;
};

export default ScrollManager;
