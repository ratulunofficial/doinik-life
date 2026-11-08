// Night-time mountain range with a violet dusk glow (background art, purely decorative).
export function Landscape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute bottom-0 right-0 h-[72vh] w-full min-w-[960px] opacity-90"
      viewBox="0 0 1440 720"
      preserveAspectRatio="xMaxYMax slice"
    >
      <defs>
        <radialGradient id="ls-glow" cx="0.86" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#c084fc" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#8b5cf6" stopOpacity="0.28" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a3486" stopOpacity="0.75" />
          <stop offset="1" stopColor="#1c1438" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="ls-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c1f58" stopOpacity="0.92" />
          <stop offset="1" stopColor="#140f2b" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="ls-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1334" />
          <stop offset="1" stopColor="#0c0a1a" />
        </linearGradient>
        <linearGradient id="ls-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0b0919" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#0b0919" stopOpacity="0.35" />
          <stop offset="1" stopColor="#0b0919" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1440" height="720" fill="url(#ls-glow)" />
      {/* far ridge with a soft rim light */}
      <path
        d="M0 520 C160 505 260 470 380 488 S600 446 720 462 S880 392 960 410 L1060 318 L1128 362 L1212 282 L1300 344 L1372 300 L1440 318 L1440 720 L0 720Z"
        fill="url(#ls-far)"
      />
      <path d="M960 410 L1060 318 L1128 362 L1212 282 L1300 344 L1372 300 L1440 318" fill="none" stroke="#d8b4fe" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* middle ridge */}
      <path
        d="M0 590 C200 572 330 552 470 570 S700 540 830 552 L948 486 L1030 524 L1112 452 L1196 506 L1286 428 L1368 488 L1440 458 L1440 720 L0 720Z"
        fill="url(#ls-mid)"
      />
      <path d="M948 486 L1030 524 L1112 452 L1196 506 L1286 428 L1368 488 L1440 458" fill="none" stroke="#a78bfa" strokeOpacity="0.22" strokeWidth="1.2" />
      {/* near ridge */}
      <path d="M0 650 C240 632 430 642 640 630 S920 600 1040 610 L1132 572 L1214 604 L1310 552 L1392 594 L1440 576 L1440 720 L0 720Z" fill="url(#ls-near)" />
      {/* fade the left side so cards there stay calm */}
      <rect width="1440" height="720" fill="url(#ls-fade)" />
    </svg>
  );
}
