export const LogoIcon = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M20 5L35 12.5V27.5L20 35L5 27.5V12.5L20 5Z"
      stroke="url(#gradient1)"
      strokeWidth="2"
      fill="none"
    />
    <circle cx="20" cy="20" r="6" fill="url(#gradient2)" />
    <path d="M20 14V26M14 20H26" stroke="#0a0e1a" strokeWidth="2" strokeLinecap="round" />
    <defs>
      <linearGradient id="gradient1" x1="5" y1="5" x2="35" y2="35">
        <stop stopColor="#00ff9f" />
        <stop offset="1" stopColor="#00d4ff" />
      </linearGradient>
      <linearGradient id="gradient2" x1="14" y1="14" x2="26" y2="26">
        <stop stopColor="#00ff9f" />
        <stop offset="1" stopColor="#00d4ff" />
      </linearGradient>
    </defs>
  </svg>
);

export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
  </svg>
);

export const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4m0-4h.01" />
  </svg>
);

export const WalletIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="8" width="24" height="16" rx="2" />
    <path d="M4 14h24M8 18h8" />
  </svg>
);

export const TrendingUpIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 24l6-8 6 4 8-12 4 4" />
    <path d="M24 8h4v4" />
  </svg>
);

export const TargetIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="16" cy="10" r="4" />
    <path d="M16 14v12m-6-4l6 4 6-4" />
  </svg>
);

export const ClockIcon = () => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="16" cy="16" r="12" />
    <path d="M16 8v8l4 4" />
  </svg>
);

export const ChartLineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3v18h18" />
    <path d="M7 16l4-6 4 2 5-7" />
  </svg>
);

export const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5H2v7h7V5zM22 5h-7v7h7V5zM9 18H2v-7h7v7zM22 18h-7v-7h7v7z" />
  </svg>
);

export const TableIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M3 9h18M3 15h18" />
  </svg>
);

export const ControlIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M1 12h6m6 0h6" />
  </svg>
);
