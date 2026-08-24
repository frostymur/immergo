"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLocale, type Locale } from "@/components/LocaleProvider";

const LOCALES: Locale[] = ["kz", "ru", "en"];

/* ------------------------------------------------------------------ */
/* Decorations                                                        */
/* ------------------------------------------------------------------ */

function Constellation({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 200" fill="none" className={`pointer-events-none absolute ${className}`} aria-hidden>
      <path d="M60 160 L200 60 L380 120 L520 40" className="stroke-primary/30" strokeWidth="1" />
      <path d="M200 60 L300 170 L520 40" className="stroke-primary/20" strokeWidth="1" />
      {[60, 200, 300, 380, 520].map((x, i) => (
        <circle key={i} cx={x} cy={[160, 60, 170, 120, 40][i]} r="4" className="fill-primary/30" />
      ))}
    </svg>
  );
}

function SunDoodle({ className = "" }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return {
      x1: 30 + Math.cos(a) * 14,
      y1: 30 + Math.sin(a) * 14,
      x2: 30 + Math.cos(a) * 22,
      y2: 30 + Math.sin(a) * 22,
    };
  });
  return (
    <svg viewBox="0 0 60 60" fill="none" className={`pointer-events-none absolute ${className}`} aria-hidden>
      <circle cx="30" cy="30" r="8" className="stroke-muted/50" strokeWidth="2" />
      {rays.map((r, i) => (
        <line key={i} {...r} className="stroke-muted/50" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function CurlyArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" fill="none" className={`pointer-events-none absolute ${className}`} aria-hidden>
      <path
        d="M8 52 C 20 20, 60 10, 96 26"
        className="stroke-muted/50"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M96 26 l-10 -2 m10 2 l-2 10" className="stroke-muted/50" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Live-board preview (static, styled like the real whiteboard)       */
/* ------------------------------------------------------------------ */

function OrbitPreview({ t }: { t: (k: string) => string }) {
  return (
    <div id="hero-preview" className="relative mx-auto mt-14 max-w-5xl scroll-mt-24 rounded-[2rem] border-2 border-[#2d2138] bg-white p-6 shadow-[8px_8px_0_#2d2138] md:p-10">
      <div className="grid gap-8 md:grid-cols-[1fr_1.25fr_1fr]">
        <div className="text-center md:text-left">
          <div className="font-hand text-2xl text-foreground">{t("mkt.board.title")}</div>
          <div className="mt-1 h-1.5 w-24 rounded bg-sky-200 mx-auto md:mx-0" />
          <p className="mt-4 font-hand text-lg leading-relaxed text-foreground/90">{t("mkt.board.note")}</p>
        </div>

        <div className="rounded-2xl bg-[#DFEACB] p-5">
          <svg viewBox="0 0 320 220" className="w-full">
            <ellipse cx="160" cy="110" rx="120" ry="72" fill="none" strokeWidth="2" className="stroke-[#2d2138]" />
            <circle cx="160" cy="110" r="30" className="fill-[#F5A623]" />
            <circle r="10" className="fill-sky-400">
              <animateMotion
                dur="8s"
                repeatCount="indefinite"
                path="M 280 110 A 120 72 0 1 1 40 110 A 120 72 0 1 1 280 110"
              />
            </circle>
          </svg>
          <div className="mt-2 text-center font-board-serif italic text-lg text-foreground">
            F = GMm / r² + sideways velocity = orbit
          </div>
        </div>

        <div className="text-center md:text-left">
          <div className="font-board-serif text-xl font-semibold text-foreground">{t("mkt.board.orbit")}</div>
          <p className="mt-3 font-hand text-lg leading-relaxed text-foreground/90">{t("mkt.board.orbitText")}</p>
          <span className="mt-4 inline-block rounded-full bg-primary/25 px-3 py-1 font-hand text-base text-[#3B2344]">
            {t("mkt.board.chip")}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Heatmap mock (teacher view)                                        */
/* ------------------------------------------------------------------ */

const HEAT_COLORS: Record<string, string> = {
  g: "bg-green-300/70",
  a: "bg-amber-300/70",
  r: "bg-red-300/70",
};

function HeatmapMock({ t }: { t: (k: string) => string }) {
  const cols = [t("mkt.heat.c1"), t("mkt.heat.c2"), t("mkt.heat.c3"), t("mkt.heat.c4")];
  const rows = [
    { name: "Aigul", cells: ["g", "r", "g", "a"] },
    { name: "Nurbol", cells: ["a", "r", "r", "g"] },
    { name: "Dana", cells: ["g", "g", "a", "a"] },
    { name: "Timur", cells: ["r", "a", "g", "r"] },
  ];
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <div className="grid grid-cols-[88px_repeat(4,1fr)] items-center gap-1.5">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted">{t("mkt.heat.students")}</div>
        {cols.map((c) => (
          <div key={c} className="text-center font-mono text-[9px] uppercase tracking-wider text-muted">
            {c}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.name} className="contents">
            <div className="truncate text-xs font-medium text-foreground">{r.name}</div>
            {r.cells.map((c, i) => (
              <div key={i} className={`h-7 rounded-md ${HEAT_COLORS[c]}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[9px] uppercase tracking-widest text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-300/70" />{t("mkt.heat.legend.ready")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-300/70" />{t("mkt.heat.legend.shaky")}</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-300/70" />{t("mkt.heat.legend.lost")}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CTAs                                                               */
/* ------------------------------------------------------------------ */

function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-[#3B2344] px-6 py-3.5 font-semibold text-white transition-colors hover:bg-[#4a2f57]"
    >
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}

function GhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-[#2d2138]/15 bg-white/70 px-6 py-3.5 font-semibold text-[#2d2138] transition-colors hover:border-[#2d2138]/40"
    >
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Landing                                                            */
/* ------------------------------------------------------------------ */

export default function MarketingLanding() {
  const { t, locale, setLocale } = useLocale();

  const steps = [
    { n: "01", title: t("mkt.step1.t"), desc: t("mkt.step1.d") },
    { n: "02", title: t("mkt.step2.t"), desc: t("mkt.step2.d") },
    { n: "03", title: t("mkt.step3.t"), desc: t("mkt.step3.d") },
    { n: "04", title: t("mkt.step4.t"), desc: t("mkt.step4.d") },
  ];

  const strip = [
    { t1: t("mkt.strip1.t"), t2: t("mkt.strip1.s") },
    { t1: t("mkt.strip2.t"), t2: t("mkt.strip2.s") },
    { t1: t("mkt.strip3.t"), t2: t("mkt.strip3.s") },
  ];

  const stats = [
    { t1: t("mkt.stat1.t"), t2: t("mkt.stat1.s") },
    { t1: t("mkt.stat2.t"), t2: t("mkt.stat2.s") },
    { t1: t("mkt.stat3.t"), t2: t("mkt.stat3.s") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Pill nav */}
      <nav className="sticky top-4 z-40 mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border bg-surface/90 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <a href="#" className="flex items-center gap-2">
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-bold tracking-tight">immergo</span>
        </a>
        <div className="hidden items-center gap-6 text-sm font-medium text-foreground/80 md:flex">
          <a href="#product" className="transition-colors hover:text-foreground">{t("mkt.nav.product")}</a>
          <a href="#how" className="transition-colors hover:text-foreground">{t("mkt.nav.how")}</a>
          <a href="#students" className="transition-colors hover:text-foreground">{t("mkt.nav.students")}</a>
          <a href="#teachers" className="transition-colors hover:text-foreground">{t("mkt.nav.teachers")}</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1 sm:flex">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                  locale === l ? "bg-primary/20 text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <Link href="/auth" className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground">
            {t("mkt.nav.login")}
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#3B2344] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4a2f57]"
          >
            {t("mkt.nav.start")}
            <ArrowRight size={13} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-4 pb-16 pt-16 text-center sm:pt-24">
        <Constellation className="left-1/2 top-6 hidden w-[560px] -translate-x-1/2 opacity-60 md:block" />
        <h1 className="relative mx-auto max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight text-[#1d1524] sm:text-6xl md:text-7xl">
          {t("mkt.hero.h1a")}
          <br />
          {t("mkt.hero.h1b")}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
          {t("mkt.hero.sub")}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <PrimaryCta href="/auth">{t("mkt.hero.cta1")}</PrimaryCta>
          <GhostCta href="#product">{t("mkt.hero.cta2")}</GhostCta>
        </div>

        <OrbitPreview t={t} />
      </section>

      {/* Product — the 4 steps */}
      <section id="product" className="scroll-mt-24 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("mkt.how.eyebrow")} ]</div>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#1d1524] sm:text-5xl md:text-6xl">
              {t("mkt.how.h")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground/70">
              {t("mkt.how.sub")}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <PrimaryCta href="/auth">{t("mkt.how.cta1")}</PrimaryCta>
              <GhostCta href="#hero-preview">{t("mkt.how.cta2")}</GhostCta>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-md">
                <div className="font-mono text-sm font-semibold text-primary">{s.n}</div>
                <div className="mt-3 text-lg font-bold text-[#1d1524]">{s.title}</div>
                <p className="mt-2 text-sm leading-relaxed text-foreground/70">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl divide-y divide-border rounded-2xl border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {strip.map((s) => (
              <div key={s.t1} className="p-5 text-center">
                <div className="text-xl font-bold text-[#1d1524]">{s.t1}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">{s.t2}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For students */}
      <section id="students" className="relative scroll-mt-24 px-4 py-16 text-center sm:py-24">
        <CurlyArrow className="left-6 top-10 hidden w-24 -scale-x-100 opacity-70 lg:block" />
        <SunDoodle className="right-10 top-8 hidden w-14 opacity-70 lg:block" />
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("mkt.students.eyebrow")} ]</div>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#1d1524] sm:text-5xl md:text-6xl">
            {t("mkt.students.h")}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground/70">
            {t("mkt.students.sub")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta href="/auth">{t("mkt.students.cta1")}</PrimaryCta>
            <GhostCta href="#product">{t("mkt.students.cta2")}</GhostCta>
          </div>

          <div className="mt-12 grid divide-y divide-border rounded-2xl border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {stats.map((s) => (
              <div key={s.t1} className="p-5 text-center">
                <div className="text-xl font-bold text-[#1d1524]">{s.t1}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">{s.t2}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For teachers */}
      <section id="teachers" className="scroll-mt-24 px-4 py-16 sm:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">[ {t("mkt.teachers.eyebrow")} ]</div>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-[#1d1524] sm:text-5xl">
              {t("mkt.teachers.h")}
            </h2>
            <p className="mt-5 text-base leading-relaxed text-foreground/70">
              {t("mkt.teachers.sub")}
            </p>
            <div className="mt-8">
              <PrimaryCta href="/auth">{t("mkt.teachers.cta")}</PrimaryCta>
            </div>
          </div>
          <HeatmapMock t={t} />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-10 text-center">
        <div className="flex items-center justify-center gap-2">
          <img src="/icon.svg" alt="" className="h-6 w-6" />
          <span className="font-bold tracking-tight">immergo</span>
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted">
          {t("mkt.footer")}
        </div>
      </footer>
    </div>
  );
}
