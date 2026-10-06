"use client";

import { useEffect } from "react";

/*
 * Arrival animations for `[data-reveal="rise|fade|ink|rule"]`, played with the
 * Web Animations API the first time an element enters the viewport. Nothing
 * is written to the DOM (no attributes, no classes), so it can never disagree
 * with React hydration. The hidden start states live in styles/motion.css and
 * only apply under `html[data-js]`; under reduced motion CSS shows everything
 * and no animation runs.
 */

const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const PLAYS: Record<string, { frames: Keyframe[]; duration: number; easing: string }> = {
  rise: {
    frames: [
      { opacity: 0, transform: "translateY(14px)" },
      { opacity: 1, transform: "none" },
    ],
    duration: 720,
    easing: EASE,
  },
  fade: { frames: [{ opacity: 0 }, { opacity: 1 }], duration: 900, easing: EASE },
  ink: { frames: [{ "--ink": "0%" }, { "--ink": "160%" }], duration: 1500, easing: "cubic-bezier(0.3, 0.1, 0.2, 1)" },
  rule: { frames: [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], duration: 1100, easing: EASE },
};

export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window) || !("animate" in Element.prototype)) {
      root.removeAttribute("data-js");
      return;
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const played = new WeakSet<Element>();
    const play = (el: Element) => {
      if (played.has(el)) return;
      played.add(el);
      const spec = PLAYS[el.getAttribute("data-reveal") ?? ""] ?? PLAYS.rise;
      const i = Number.parseFloat(getComputedStyle(el).getPropertyValue("--i")) || 0;
      el.animate(spec.frames, { duration: spec.duration, delay: i * 70, easing: spec.easing, fill: "both" });
    };
    const io = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (!r.isIntersecting) continue;
          play(r.target);
          io.unobserve(r.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const scan = (node: ParentNode) =>
      node.querySelectorAll("[data-reveal]").forEach((el) => !played.has(el) && io.observe(el));
    scan(document);
    const mo = new MutationObserver((list) => {
      for (const m of list)
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches("[data-reveal]") && !played.has(n)) io.observe(n);
          scan(n);
        });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
