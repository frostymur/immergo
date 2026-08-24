"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#A78BFA", "#9DD9C7", "#FCE9B8", "#7EC8E3", "#FBBF24", "#F87171"];

/**
 * Dependency-free canvas confetti. Bump `burst` to fire one celebration;
 * 0 means nothing. Pieces fly out from the upper-center and fade away.
 */
export default function Confetti({ burst, count = 120 }: { burst: number; count?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!burst || !ref.current) return;
    const canvas = ref.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const parts = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * window.innerWidth * 0.35,
      y: window.innerHeight * 0.22,
      vx: (Math.random() - 0.5) * 10,
      vy: -Math.random() * 11 - 4,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }));

    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of parts) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - t / 2600);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 2600) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [burst, count]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[100]" />;
}
