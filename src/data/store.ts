"use client";

import { useSyncExternalStore } from "react";
import type { AppState } from "../domain/state";
import { initialState } from "../domain/state";
import type { IsoDate } from "../domain/types";
import { localTodayIso } from "../domain/week";
import { loadSimDate, localRepository, saveSimDate, type KeyValueStorage, type StateRepository } from "./storage";

/** Store reattivo lato client: stato salvato + "oggi" (reale o simulato). */
export interface Snapshot {
  state: AppState;
  today: IsoDate;
  simDate?: IsoDate;
}

let snap: Snapshot | null = null;
const listeners = new Set<() => void>();

function storage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined; // modalità privata / storage bloccato
  }
}

function repo(): StateRepository {
  const s = storage();
  let memory: AppState | undefined;
  return s
    ? localRepository(s)
    : { load: () => memory ?? initialState(), save: (st) => void (memory = st) };
}

function emit() {
  listeners.forEach((l) => l());
}

function refreshToday() {
  if (!snap) return;
  const today = snap.simDate ?? localTodayIso();
  if (today !== snap.today) {
    snap = { ...snap, today };
    emit();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("focus", refreshToday);
  document.addEventListener("visibilitychange", refreshToday);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", refreshToday);
    document.removeEventListener("visibilitychange", refreshToday);
  };
}

function getSnapshot(): Snapshot | null {
  if (typeof window === "undefined") return null;
  if (!snap) {
    const s = storage();
    const simDate = s ? loadSimDate(s) : undefined;
    snap = { state: repo().load(), simDate, today: simDate ?? localTodayIso() };
  }
  return snap;
}

const getServerSnapshot = (): Snapshot | null => null;

export function useCoach(): Snapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Applica una modifica allo stato e la salva. Se `fn` lancia, lo stato resta com'era. */
export function updateState(fn: (s: AppState) => AppState): void {
  const cur = getSnapshot();
  if (!cur) return;
  const next = fn(cur.state);
  repo().save(next);
  snap = { ...cur, state: next };
  emit();
}

export function replaceState(state: AppState): void {
  updateState(() => state);
}

export function setSimDate(date: IsoDate | undefined): void {
  const cur = getSnapshot();
  if (!cur) return;
  const s = storage();
  if (s) saveSimDate(s, date);
  snap = { ...cur, simDate: date, today: date ?? localTodayIso() };
  emit();
}
