"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { IsoDate } from "../domain/types";

/** Tempo di pressione prima di "sollevare" una riga. */
export const LONG_PRESS_MS = 350;
/** Se il dito si muove più di così prima del tempo, è uno scroll: niente trascinamento. */
const SCROLL_SLOP_PX = 10;

export interface WeekListItem {
  date: IsoDate;
  /** Si può sollevare e spostare questo giorno. */
  movable: boolean;
  /** Contenuto della riga (il bottone che apre i dettagli). */
  content: ReactNode;
}

/**
 * Lista dei giorni con trascinamento: tieni premuto un giorno, poi trascinalo su un altro e rilascia
 * per scambiarli. Un tocco normale resta un tocco (apre i dettagli); scorrere resta scorrere.
 */
export function WeekList({
  items,
  onMove,
  onBlocked,
}: {
  items: WeekListItem[];
  /** `from` è stato rilasciato su `to`. */
  onMove: (from: IsoDate, to: IsoDate) => void;
  /** Hai provato a spostare qualcosa che non si sposta (passato, già fatto…). */
  onBlocked?: (date: IsoDate) => void;
}) {
  const [drag, setDrag] = useState<{ date: IsoDate; dy: number; over?: IsoDate } | undefined>();
  const rows = useRef(new Map<IsoDate, HTMLLIElement>());
  const listRef = useRef<HTMLUListElement>(null);
  const g = useRef<{ timer?: ReturnType<typeof setTimeout>; x: number; y: number; date?: IsoDate; over?: IsoDate; active: boolean; blocked: boolean; suppressClick: boolean }>({
    x: 0,
    y: 0,
    active: false,
    blocked: false,
    suppressClick: false,
  });

  // Mentre trascini, la pagina non deve scorrere. Serve un listener nativo non passivo (quelli di React sono passivi).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (g.current.active && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  function overOf(clientY: number, self: IsoDate): IsoDate | undefined {
    for (const [date, el] of rows.current) {
      if (date === self) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return date;
    }
    return undefined;
  }

  function end(commit: boolean) {
    const s = g.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = undefined;
    // Dopo un trascinamento, o dopo il messaggio "non si sposta", il rilascio non deve aprire la scheda del giorno.
    if (s.active || s.blocked) {
      s.suppressClick = true;
      setTimeout(() => (g.current.suppressClick = false), 150);
    }
    if (s.active && s.date) {
      const over = s.over;
      if (commit && over && over !== s.date) onMove(s.date, over);
    }
    s.blocked = false;
    s.active = false;
    s.date = undefined;
    s.over = undefined;
    setDrag(undefined);
  }

  return (
    <ul ref={listRef} className="space-y-2">
      {items.map((it) => {
        const dragging = drag?.date === it.date;
        const target = drag?.over === it.date;
        return (
          <li
            key={it.date}
            ref={(el) => {
              if (el) rows.current.set(it.date, el);
              else rows.current.delete(it.date);
            }}
            className={`relative select-none [-webkit-touch-callout:none] ${dragging ? "z-30 rounded-xl bg-white shadow-2xl ring-2 ring-orange-500 dark:bg-zinc-900 [&>button]:!opacity-100" : "transition-transform"} ${target ? "rounded-xl outline outline-2 outline-dashed outline-orange-500" : ""}`}
            style={dragging ? { transform: `translateY(${drag.dy}px) scale(1.02)`, touchAction: "none" } : undefined}
            data-date={it.date}
            data-dragging={dragging || undefined}
            onContextMenu={(e) => e.preventDefault()}
            onClickCapture={(e) => {
              if (g.current.suppressClick) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType === "mouse") return;
              const s = g.current;
              s.x = e.clientX;
              s.y = e.clientY;
              s.date = it.date;
              s.active = false;
              s.blocked = false;
              s.over = undefined;
              if (s.timer) clearTimeout(s.timer);
              const el = e.currentTarget;
              const pointerId = e.pointerId;
              s.timer = setTimeout(() => {
                if (!it.movable) {
                  s.blocked = true;
                  onBlocked?.(it.date);
                  return;
                }
                s.active = true;
                try {
                  el.setPointerCapture(pointerId);
                } catch {
                  /* il puntatore è già finito */
                }
                navigator.vibrate?.(12);
                setDrag({ date: it.date, dy: 0 });
              }, LONG_PRESS_MS);
            }}
            onPointerMove={(e) => {
              const s = g.current;
              if (!s.active) {
                if (s.timer && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SCROLL_SLOP_PX) {
                  clearTimeout(s.timer);
                  s.timer = undefined;
                }
                return;
              }
              if (s.date) {
                s.over = overOf(e.clientY, s.date);
                setDrag({ date: s.date, dy: e.clientY - s.y, over: s.over });
              }
            }}
            onPointerUp={() => end(true)}
            onPointerCancel={() => end(false)}
          >
            {it.content}
          </li>
        );
      })}
    </ul>
  );
}
