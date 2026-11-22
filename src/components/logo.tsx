/** Logo: una "C" (Coach) aperta, con il punto del ritmo nel varco. Stessa forma di public/logo.svg. */
export function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" role="img" aria-label="Coach" className={className}>
      <defs>
        <linearGradient id="coach-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fb923c" />
          <stop offset="1" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#coach-logo-g)" />
      <path d="M352.7 188.3A118 118 0 1 0 352.7 323.7" fill="none" stroke="#fff" strokeWidth="42" strokeLinecap="round" />
      <circle cx="362" cy="256" r="28" fill="#fff" />
    </svg>
  );
}
