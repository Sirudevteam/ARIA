import React from "react";

interface LidarBackgroundProps {
  className?: string;
  opacity?: number;
}

/**
 * Renders a subtle dot-grid background that evokes a 3D LiDAR point cloud field.
 * Use as an absolutely-positioned layer behind page content.
 */
export function LidarBackground({ className = "", opacity = 0.18 }: LidarBackgroundProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {/* Primary dot grid */}
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lidar-grid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.9" fill="#0ea5e9" />
          </pattern>
          {/* Sparse large-dot overlay */}
          <pattern id="lidar-far" x="0" y="0" width="84" height="84" patternUnits="userSpaceOnUse">
            <circle cx="42" cy="42" r="1.4" fill="#22d3ee" opacity="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lidar-grid)" />
        <rect width="100%" height="100%" fill="url(#lidar-far)" />
      </svg>

      {/* Radial fade vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 60% at 50% 50%, transparent 10%, rgba(2,8,23,0.85) 100%)",
        }}
      />
    </div>
  );
}
