import type { ReactNode } from "react";
import type { Advice } from "../domain/types";

type Tone = "default" | "ok" | "warn" | "stop" | "info" | "accent";

const TONES: Record<Tone, string> = {
  default: "bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800",
  ok: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900",
  warn: "bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:border-amber-800",
  stop: "bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-800",
  info: "bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900",
  accent: "bg-orange-500 border-orange-500 text-white",
};

export function Card({ children, tone = "default", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <section className={`rounded-2xl border p-4 ${TONES[tone]} ${className}`}>{children}</section>;
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between px-1">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{children}</h2>
      {right}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-4 pt-2">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{sub}</p> : null}
    </header>
  );
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "ok" | "warn" | "stop" | "accent" }) {
  const c = {
    default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200",
    stop: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
    accent: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>;
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
      <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-500 px-4 py-2 font-semibold text-white active:bg-orange-600 disabled:opacity-50";
export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-2 font-medium active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:active:bg-zinc-800";
export const btnDanger =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-800 active:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200";
export const inputCls =
  "w-full min-h-11 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{hint}</span> : null}
    </label>
  );
}

const ADVICE_TONE: Record<Advice["level"], Tone> = { info: "info", warning: "warn", stop: "stop" };
const ADVICE_ICON: Record<Advice["level"], string> = { info: "ℹ️", warning: "⚠️", stop: "🛑" };

export function AdviceList({ advices }: { advices: Advice[] }) {
  if (advices.length === 0) return null;
  return (
    <div className="space-y-2">
      {advices.map((a, i) => (
        <Card key={`${a.rule}-${i}`} tone={ADVICE_TONE[a.level]} className="!p-3">
          <p className="font-semibold">
            <span aria-hidden>{ADVICE_ICON[a.level]} </span>
            {a.title} <span className="text-xs font-normal opacity-60">{a.rule}</span>
          </p>
          <p className="mt-1 text-sm">{a.message}</p>
          {a.seeProfessional ? (
            <p className="mt-2 text-sm font-semibold">Il coach non è un medico: rivolgiti a un professionista.</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function Loading() {
  return <p className="py-16 text-center text-zinc-500">Carico…</p>;
}
