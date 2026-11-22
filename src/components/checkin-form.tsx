"use client";

import { useState } from "react";
import { updateState } from "../data/store";
import { addCheckIn } from "../domain/state";
import type { CheckIn, IsoDate, PainLocation, PainType } from "../domain/types";
import { btnPrimary, Field, inputCls } from "./ui";

/** Check-in veloce: alimenta R2 (gambe pesanti/tibie) e R3 (dolore puntiforme). */
export function CheckInForm({ today, current }: { today: IsoDate; current?: CheckIn }) {
  const [heavy, setHeavy] = useState(current?.heavyLegs ?? false);
  const [pain, setPain] = useState(current?.pain ?? 0);
  const [loc, setLoc] = useState<PainLocation>(current?.painLocation ?? "tibia");
  const [type, setType] = useState<PainType>(current?.painType ?? "diffuso");
  const [saved, setSaved] = useState(false);

  function save() {
    updateState((s) =>
      addCheckIn(s, {
        date: today,
        pain,
        heavyLegs: heavy,
        ...(pain > 0 ? { painLocation: loc, painType: type } : {}),
      }),
    );
    setSaved(true);
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={heavy} onChange={(e) => { setHeavy(e.target.checked); setSaved(false); }} />
        <span>Gambe pesanti oggi</span>
      </label>
      <Field label={`Dolore: ${pain}/10`}>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => { setPain(Number(e.target.value)); setSaved(false); }} className="w-full" />
      </Field>
      {pain > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dove">
            <select className={inputCls} value={loc} onChange={(e) => { setLoc(e.target.value as PainLocation); setSaved(false); }}>
              <option value="tibia">Tibia</option>
              <option value="polpaccio">Polpaccio</option>
              <option value="altro">Altro</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as PainType); setSaved(false); }}>
              <option value="diffuso">Diffuso</option>
              <option value="puntiforme">Puntiforme (su un punto dell&apos;osso)</option>
            </select>
          </Field>
        </div>
      ) : null}
      <button type="submit" className={`${btnPrimary} w-full`}>
        Salva check-in
      </button>
      {saved ? <p className="text-center text-sm text-emerald-700 dark:text-emerald-300">Salvato: il piano è stato rivalutato.</p> : null}
    </form>
  );
}
