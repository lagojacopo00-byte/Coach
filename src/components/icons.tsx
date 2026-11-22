import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ children, className = "h-6 w-6" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export const IconToday = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="4.5" width="18" height="16" rx="3" />
    <path d="M3 9.5h18M8 3v3M16 3v3" />
    <circle cx="12" cy="15" r="1.7" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconWeeks = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="3.5" width="18" height="17" rx="3" />
    <path d="M3 9h18M3 14.5h18M9 9v11.5M15 9v11.5" />
  </Svg>
);

export const IconRuns = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />
  </Svg>
);

export const IconUser = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
  </Svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);

export const IconX = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3.5l9.5 16.5h-19z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </Svg>
);

export const IconStop = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.7 5.7l12.6 12.6" />
  </Svg>
);

export const IconInfo = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.01" />
  </Svg>
);

export const IconChevron = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M9 6l6 6-6 6" />
  </Svg>
);
