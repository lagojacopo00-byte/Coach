"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Oggi", icon: "🏠" },
  { href: "/domenica", label: "Domenica", icon: "🗓️" },
  { href: "/corsa", label: "Corsa", icon: "➕" },
  { href: "/piano", label: "Piano", icon: "📈" },
  { href: "/profilo", label: "Profilo", icon: "👤" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-orange-600 dark:text-orange-400" : "text-zinc-500"}`}
              >
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
