// Dopo la build: nessuna route /api deve essere prerenderizzata (statica).
// Una route che legge variabili d'ambiente o cookie ma finisce statica resta "congelata" ai valori della build.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = ".next/server/app/api";
const found = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(body|html|rsc)$/.test(name)) found.push(p);
  }
}
if (existsSync(root)) walk(root);
if (found.length > 0) {
  console.error("Route /api prerenderizzate (statiche) trovate: devono leggere la richiesta (cookie o URL) prima di tutto.");
  for (const f of found) console.error(" -", f);
  process.exit(1);
}
console.log("Route /api: tutte dinamiche.");
