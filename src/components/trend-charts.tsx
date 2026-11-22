"use client";

import { useState } from "react";
import type { TrendPoint } from "../domain/views";

interface Props {
  title: string;
  unit: string;
  data: TrendPoint[];
  pick: (p: TrendPoint) => { planned: number; actual: number };
  currentIndex?: number;
}

const W = 340;
const H = 132;
const LEFT = 26;
const TOP = 8;
const BOTTOM = 20;
const BAR = 7;
const GAP = 2;
const RADIUS = 3.5;

/** Barra con spigolo superiore arrotondato (4px circa) e base dritta sulla linea di zero. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z`;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const step = v > 30 ? 10 : 5;
  return Math.ceil(v / step) * step;
}

/** Barre affiancate: pianificato (grigio, contesto) e fatto (arancio). Tocca una settimana per i valori. */
export function TrendChart({ title, unit, data, pick, currentIndex }: Props) {
  const [sel, setSel] = useState<number | undefined>(currentIndex);
  const values = data.map(pick);
  const max = niceMax(Math.max(...values.map((v) => Math.max(v.planned, v.actual))));
  const plotH = H - TOP - BOTTOM;
  const slot = (W - LEFT) / data.length;
  const yOf = (v: number) => TOP + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const shown = sel !== undefined ? data.findIndex((d) => d.index === sel) : -1;
  const s = shown >= 0 ? { p: data[shown], v: values[shown] } : undefined;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <ul className="flex gap-3 text-xs text-zinc-600 dark:text-zinc-400" aria-label="Legenda">
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600" />Pianificato</li>
          <li className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />Fatto</li>
        </ul>
      </div>
      <p className="mt-1 min-h-5 text-sm text-zinc-700 dark:text-zinc-300" aria-live="polite">
        {s
          ? `Sett. ${s.p.index}${s.p.deload ? " (scarico)" : ""}: pianificato ${s.v.planned.toFixed(0)} ${unit}, fatto ${s.v.actual > 0 ? s.v.actual.toFixed(1) : "0"} ${unit}`
          : "Tocca una settimana per i valori"}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${title}, pianificato e fatto per settimana`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={W} y1={yOf(t)} y2={yOf(t)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} />
            <text x={LEFT - 4} y={yOf(t) + 3} textAnchor="end" fontSize={9} className="fill-zinc-500 dark:fill-zinc-400">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = values[i];
          const x0 = LEFT + i * slot + (slot - (BAR * 2 + GAP)) / 2;
          const isSel = sel === d.index;
          return (
            <g key={d.index}>
              {isSel ? <rect x={LEFT + i * slot} y={TOP} width={slot} height={plotH + BOTTOM} rx={4} className="fill-orange-500/10" /> : null}
              <path d={barPath(x0, yOf(v.planned), BAR, yOf(0) - yOf(v.planned))} className="fill-zinc-300 dark:fill-zinc-600" />
              <path d={barPath(x0 + BAR + GAP, yOf(v.actual), BAR, yOf(0) - yOf(v.actual))} className="fill-orange-500" />
              <text x={LEFT + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={9} className={isSel || d.index === currentIndex ? "fill-orange-600 font-bold dark:fill-orange-400" : "fill-zinc-500 dark:fill-zinc-400"}>{d.index}</text>
              <rect x={LEFT + i * slot} y={0} width={slot} height={H} fill="transparent" onClick={() => setSel(d.index)} onMouseEnter={() => setSel(d.index)} />
            </g>
          );
        })}
      </svg>
      <details className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer py-1">Tabella</summary>
        <table className="w-full text-left">
          <thead><tr><th className="py-0.5">Sett.</th><th>Pianificato</th><th>Fatto</th></tr></thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.index}><td className="py-0.5">{d.index}{d.deload ? " (scarico)" : ""}</td><td>{values[i].planned.toFixed(0)} {unit}</td><td>{values[i].actual.toFixed(1)} {unit}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
