"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconRuns, IconToday, IconUser, IconWeeks } from "./icons";

const TABS = [
  { href: "/", label: "Oggi", Icon: IconToday },
  { href: "/settimane", label: "Settimane", Icon: IconWeeks },
  { href: "/corsa", label: "Corse", Icon: IconRuns },
  { href: "/profilo", label: "Profilo", Icon: IconUser },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? "font-semibold text-orange-600 dark:text-orange-400" : "text-zinc-500"}`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
