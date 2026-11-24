import { updateState } from "../data/store";
import { addRun } from "../domain/state";
import { importSummary, planImport, type ImportedActivity } from "../domain/strava";
import { plannedRunKindOn } from "./run-form";

const TRAIL = ["TrailRun", "trail_running"];

/** Importa le attività nello stato (senza doppioni) e racconta cosa è successo. */
export function applyImport(activities: readonly ImportedActivity[]): string {
  let summary = "";
  updateState((s) => {
    const plan = planImport(s.runs, activities, (a) => plannedRunKindOn(a.date) ?? (TRAIL.includes(a.sportType) ? "trail" : "easy"));
    summary = importSummary(plan);
    return plan.toAdd.reduce(addRun, s);
  });
  return summary;
}
