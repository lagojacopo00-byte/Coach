"use client";

import type { InputHTMLAttributes } from "react";
import { formatTimeDigits } from "../domain/guidance";
import { inputCls } from "./ui";

/**
 * Campo per tempi e passi: sulla tastiera numerica dell'iPhone non ci sono i due punti, quindi si scrivono
 * solo le cifre (4139) e il campo le mette a posto (41:39).
 */
export function TimeInput({
  value,
  onChange,
  maxDigits = 6,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "inputMode"> & {
  value: string;
  onChange: (formatted: string) => void;
  maxDigits?: number;
}) {
  return (
    <input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      className={inputCls}
      value={value}
      onChange={(e) => onChange(formatTimeDigits(e.target.value, maxDigits))}
    />
  );
}
