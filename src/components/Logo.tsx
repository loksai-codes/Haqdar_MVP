import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = true,
  className = ''
}) => {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 34;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Bespoke Geometric Graph-Shield Emblem */}
      <div className="relative shrink-0 flex items-center justify-center">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Emerald to Cyan gradient for primary arc */}
            <linearGradient id="haqdar-grad-primary" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Glowing Accent Gradient */}
            <linearGradient id="haqdar-grad-glow" x1="12" y1="8" x2="36" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
            </linearGradient>

            {/* Core Shield Shadow filter */}
            <filter id="haqdar-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Background Rounded Diamond Shield */}
          <rect
            x="4"
            y="4"
            width="40"
            height="40"
            rx="12"
            fill="#090d16"
            stroke="url(#haqdar-grad-primary)"
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />

          {/* Inner Geometric Welfare Network Nodes & Vectors */}
          {/* Top Node (Scheme Authority) */}
          <circle cx="24" cy="14" r="3.5" fill="#34d399" filter="url(#haqdar-glow-filter)" />
          
          {/* Bottom Left Node (Citizen Demographics) */}
          <circle cx="14" cy="32" r="3.2" fill="#38bdf8" />
          
          {/* Bottom Right Node (Verified Entitlement) */}
          <circle cx="34" cy="32" r="3.2" fill="#10b981" />

          {/* Center Bridge Node (Prerequisite Unlock Core) */}
          <circle cx="24" cy="25" r="2.5" fill="#f59e0b" />

          {/* Connecting Vectors (Knowledge Graph Traversal) */}
          <path
            d="M 24 14 L 24 25 M 24 25 L 14 32 M 24 25 L 34 32"
            stroke="url(#haqdar-grad-primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Outer Protective Harmonic Orbit Arc */}
          <path
            d="M 12 20 C 12 11 36 11 36 20 C 36 33 24 40 24 40 C 24 40 12 33 12 20 Z"
            stroke="url(#haqdar-grad-glow)"
            strokeWidth="1.2"
            strokeDasharray="2 3"
            fill="none"
          />
        </svg>
      </div>

      {/* Brand Typography */}
      <div className="leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="font-extrabold tracking-tight text-white font-sans text-base sm:text-lg group-hover:text-emerald-300 transition-colors">
            Haqdar
          </span>
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            GRAPH
          </span>
        </div>
        {showTagline && (
          <div className="text-[10px] text-slate-400 font-medium tracking-wide">
            Welfare Benefit Intelligence
          </div>
        )}
      </div>
    </div>
  );
};
