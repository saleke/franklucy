"use client";

import React from "react";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
  subtitle?: string;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = "md",
  showSubtitle = true,
  subtitle = "Commercial Operations",
  className = "",
}) => {
  const iconSizeClasses = {
    sm: "w-7 h-7 rounded-lg",
    md: "w-9 h-9 rounded-xl",
    lg: "w-12 h-12 rounded-2xl",
    xl: "w-16 h-16 rounded-2xl",
  };

  const titleSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  const subtitleSizeClasses = {
    sm: "text-[9px]",
    md: "text-[10px]",
    lg: "text-xs",
    xl: "text-sm",
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Brand Icon Mark - The Luminary Prism Gem */}
      <div
        className={`${iconSizeClasses[size]} relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center border border-white/15 shadow-[0_8px_20px_-4px_rgba(14,165,233,0.35)] ring-1 ring-sky-500/20 shrink-0 select-none group`}
      >
        {/* Specular Inner Highlight Sheen */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

        {/* Vector Prism Gem Emblem */}
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5 transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Top Cyan Facet (Frank - Clear Foundation) */}
            <linearGradient id="prism-top-facet" x1="18" y1="4" x2="6" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="60%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>

            {/* Right Emerald Teal Facet (Lucy - Radiant Light) */}
            <linearGradient id="prism-right-facet" x1="18" y1="4" x2="30" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="60%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>

            {/* Bottom Sapphire Base Facet (Commerce Anchor) */}
            <linearGradient id="prism-base-facet" x1="6" y1="20" x2="28" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>

            {/* Core Radiant Star Spark */}
            <radialGradient id="prism-core-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient Core Aura */}
          <circle cx="18" cy="18" r="9" fill="url(#prism-core-glow)" />

          {/* Hexagonal Isometric Crystalline Geometry */}
          {/* Top-Left Facet */}
          <path
            d="M18 4L6 11V23L18 18V4Z"
            fill="url(#prism-top-facet)"
            opacity="0.95"
          />

          {/* Right Facet */}
          <path
            d="M18 4L30 11V23L18 32V18L30 11"
            fill="url(#prism-right-facet)"
            opacity="0.9"
          />

          {/* Bottom-Left Facet */}
          <path
            d="M6 23L18 32L18 18L6 11V23Z"
            fill="url(#prism-base-facet)"
            opacity="0.85"
          />

          {/* Precision Specular Facet Ridges */}
          <path
            d="M18 4L18 32"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <path
            d="M6 11L30 23"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
          <path
            d="M30 11L6 23"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.6"
            strokeLinecap="round"
          />

          {/* Central Brilliant Radiant Spark (Lux / Lucy = Light) */}
          <circle
            cx="18"
            cy="18"
            r="2.2"
            fill="#FFFFFF"
            className="drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
          />
          <circle
            cx="18"
            cy="18"
            r="1"
            fill="#E0F2FE"
          />
        </svg>
      </div>

      {/* Brand Wordmark & Tagline */}
      <div className="flex flex-col justify-center select-none">
        <div
          className={`${titleSizeClasses[size]} font-black tracking-tight leading-none text-text-primary flex items-center gap-0.5`}
        >
          <span className="text-white tracking-tight drop-shadow-sm">Frank</span>
          <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent font-black tracking-tight filter drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]">
            Lucy
          </span>
        </div>

        {showSubtitle && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.9)] animate-pulse" />
            <span
              className={`${subtitleSizeClasses[size]} text-text-muted font-bold tracking-widest uppercase`}
            >
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const BrandLogoIcon: React.FC<{ className?: string }> = ({
  className = "w-8 h-8",
}) => {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="prism-top-facet-icon" x1="18" y1="4" x2="6" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#67E8F9" />
          <stop offset="60%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        <linearGradient id="prism-right-facet-icon" x1="18" y1="4" x2="30" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="60%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>

        <linearGradient id="prism-base-facet-icon" x1="6" y1="20" x2="28" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="50%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>

        <radialGradient id="prism-core-glow-icon" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="18" cy="18" r="9" fill="url(#prism-core-glow-icon)" />

      <path
        d="M18 4L6 11V23L18 18V4Z"
        fill="url(#prism-top-facet-icon)"
        opacity="0.95"
      />
      <path
        d="M18 4L30 11V23L18 32V18L30 11"
        fill="url(#prism-right-facet-icon)"
        opacity="0.9"
      />
      <path
        d="M6 23L18 32L18 18L6 11V23Z"
        fill="url(#prism-base-facet-icon)"
        opacity="0.85"
      />

      <path
        d="M18 4L18 32"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M6 11L30 23"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
      <path
        d="M30 11L6 23"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="0.6"
        strokeLinecap="round"
      />

      <circle
        cx="18"
        cy="18"
        r="2.2"
        fill="#FFFFFF"
        className="drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]"
      />
      <circle cx="18" cy="18" r="1" fill="#E0F2FE" />
    </svg>
  );
};

