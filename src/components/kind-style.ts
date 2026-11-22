import type { SessionKind } from "../domain/types";

/** Colori per tipo di seduta: si capisce al volo cos'è. Il testo c'è sempre, il colore aiuta. */
export interface KindStyle {
  /** Sfondo + testo di una cella/chip. */
  cell: string;
  /** Barra laterale colorata. */
  bar: string;
}

const EASY: KindStyle = {
  cell: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/50 dark:text-emerald-100",
  bar: "bg-emerald-500",
};
const LONG: KindStyle = {
  cell: "bg-indigo-100 text-indigo-950 dark:bg-indigo-900/50 dark:text-indigo-100",
  bar: "bg-indigo-500",
};
const HILLS: KindStyle = {
  cell: "bg-rose-100 text-rose-950 dark:bg-rose-900/50 dark:text-rose-100",
  bar: "bg-rose-500",
};
const THRESHOLD: KindStyle = {
  cell: "bg-violet-100 text-violet-950 dark:bg-violet-900/50 dark:text-violet-100",
  bar: "bg-violet-500",
};
const RM: KindStyle = {
  cell: "bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-900/50 dark:text-fuchsia-100",
  bar: "bg-fuchsia-500",
};
const TEST: KindStyle = {
  cell: "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100",
  bar: "bg-amber-500",
};
const RACE: KindStyle = {
  cell: "bg-yellow-300 text-yellow-950 dark:bg-yellow-400 dark:text-yellow-950",
  bar: "bg-yellow-500",
};
const GYM: KindStyle = {
  cell: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400",
  bar: "bg-zinc-400",
};
const BIKE: KindStyle = {
  cell: "bg-sky-100 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100",
  bar: "bg-sky-500",
};
const REST: KindStyle = {
  cell: "bg-transparent text-zinc-400 dark:text-zinc-600",
  bar: "bg-zinc-300 dark:bg-zinc-700",
};

export const KIND_STYLE: Record<SessionKind, KindStyle> = {
  easy: EASY,
  long: LONG,
  long_rm: LONG,
  trail: LONG,
  hills: HILLS,
  threshold: THRESHOLD,
  rm_blocks: RM,
  threshold_test: TEST,
  half_test: TEST,
  race: RACE,
  gym: GYM,
  bike: BIKE,
  rest: REST,
};

/** Legenda: una voce per gruppo di colore. */
export const LEGEND: { label: string; kind: SessionKind }[] = [
  { label: "Easy", kind: "easy" },
  { label: "Lungo", kind: "long" },
  { label: "Salite", kind: "hills" },
  { label: "Soglia", kind: "threshold" },
  { label: "RM", kind: "rm_blocks" },
  { label: "Test / gara", kind: "threshold_test" },
  { label: "Pesi", kind: "gym" },
];
