import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export const EASE = "power2.out";

export const DUR = {
  quick: 0.22,
  base: 0.4,
  slow: 0.6,
};

export function motionOk(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function reduced(build: () => void): void {
  if (motionOk()) build();
}

export function enter(
  targets: gsap.TweenTarget,
  from: gsap.TweenVars = {},
  vars: gsap.TweenVars = {},
): gsap.core.Tween {
  return gsap.fromTo(
    targets,
    { opacity: 0, ...from },
    {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: DUR.base,
      ease: EASE,
      overwrite: "auto",
      clearProps: "opacity,transform",
      ...vars,
    },
  );
}

export { gsap, useGSAP };
