import React from "react";

interface VehicleWireframeProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Clean top-down vehicle wireframe SVG with LiDAR scan rings.
 */
export function VehicleWireframe({ className = "", width = 280, height = 200 }: VehicleWireframeProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Autonomous vehicle top-down LiDAR view"
    >
      {/* LiDAR scan rings */}
      <circle cx="140" cy="100" r="88" stroke="#0ea5e9" strokeWidth="0.6" strokeDasharray="4 6" opacity="0.25" />
      <circle cx="140" cy="100" r="65" stroke="#0ea5e9" strokeWidth="0.7" strokeDasharray="3 5" opacity="0.35" />
      <circle cx="140" cy="100" r="42" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="2 4" opacity="0.45" />
      <circle cx="140" cy="100" r="20" stroke="#22d3ee" strokeWidth="1.0" opacity="0.55" />

      {/* Vehicle body */}
      <rect x="108" y="52" width="64" height="96" rx="10" stroke="#38bdf8" strokeWidth="1.5" fill="rgba(14,165,233,0.06)" />
      <rect x="116" y="58" width="48" height="22" rx="4" stroke="#7dd3fc" strokeWidth="1" fill="rgba(125,211,252,0.08)" />
      <rect x="116" y="120" width="48" height="18" rx="4" stroke="#7dd3fc" strokeWidth="1" fill="rgba(125,211,252,0.08)" />
      <rect x="118" y="48" width="44" height="6" rx="3" stroke="#38bdf8" strokeWidth="1" fill="rgba(14,165,233,0.1)" />
      <rect x="118" y="146" width="44" height="6" rx="3" stroke="#38bdf8" strokeWidth="1" fill="rgba(14,165,233,0.1)" />

      {/* Wheels */}
      <rect x="102" y="62" width="10" height="22" rx="3" stroke="#64748b" strokeWidth="1.2" fill="rgba(15,23,42,0.8)" />
      <rect x="168" y="62" width="10" height="22" rx="3" stroke="#64748b" strokeWidth="1.2" fill="rgba(15,23,42,0.8)" />
      <rect x="102" y="116" width="10" height="22" rx="3" stroke="#64748b" strokeWidth="1.2" fill="rgba(15,23,42,0.8)" />
      <rect x="168" y="116" width="10" height="22" rx="3" stroke="#64748b" strokeWidth="1.2" fill="rgba(15,23,42,0.8)" />

      {/* LiDAR sensor (roof-mounted) */}
      <circle cx="140" cy="100" r="7" stroke="#22d3ee" strokeWidth="1.5" fill="rgba(34,211,238,0.15)" />
      <circle cx="140" cy="100" r="3" fill="#22d3ee" opacity="0.9" />

      {/* Forward radar returns */}
      <circle cx="140" cy="35" r="2" fill="#0ea5e9" opacity="0.7" />
      <circle cx="128" cy="38" r="1.5" fill="#0ea5e9" opacity="0.5" />
      <circle cx="152" cy="38" r="1.5" fill="#0ea5e9" opacity="0.5" />
      <circle cx="118" cy="44" r="1.2" fill="#0ea5e9" opacity="0.35" />
      <circle cx="162" cy="44" r="1.2" fill="#0ea5e9" opacity="0.35" />

      {/* Example bounding box annotation */}
      <rect x="60" y="72" width="28" height="18" rx="2" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 2" fill="rgba(245,158,11,0.05)" />
      <circle cx="74" cy="81" r="1.5" fill="#f59e0b" opacity="0.7" />

      {/* Direction indicator */}
      <polygon points="140,20 136,30 144,30" fill="#0ea5e9" opacity="0.6" />
    </svg>
  );
}
