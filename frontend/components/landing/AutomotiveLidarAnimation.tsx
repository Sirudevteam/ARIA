"use client";

import React, { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, Crosshair, Cpu, Eye, Radio, Sparkles } from "lucide-react";

interface DetectedObject {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  label: string;
  confidence: number;
  color: string;
  type: "vehicle" | "pedestrian" | "cyclist" | "truck";
}

export function AutomotiveLidarAnimation() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeViewMode, setActiveViewMode] = useState<"intensity" | "elevation" | "segmentation">("elevation");
  const [isHovered, setIsHovered] = useState(false);
  const [fps, setFps] = useState(60);
  const [pointCount, setPointCount] = useState(128000);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 420);

    const handleResize = () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = Math.min(460, Math.max(360, width * 0.45));
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // Simulation State
    let angle = 0;
    let roadOffset = 0;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    // Generate Synthetic 3D Point Cloud
    interface Point3D {
      x: number;
      y: number;
      z: number;
      baseX: number;
      baseY: number;
      baseZ: number;
      intensity: number;
      category: number; // 0: road, 1: curb, 2: building, 3: vehicle, 4: vegetation
    }

    const points: Point3D[] = [];
    const numPoints = 1200;

    // Ground Plane & Road Markings
    for (let i = 0; i < numPoints; i++) {
      const bx = (Math.random() - 0.5) * 600;
      const bz = Math.random() * 400 + 20;
      const by = 80 + Math.sin(bx * 0.05) * 5;
      const isRoad = Math.abs(bx) < 140;
      const isCurb = Math.abs(bx) >= 140 && Math.abs(bx) < 160;
      const isVegetation = Math.abs(bx) >= 160;

      points.push({
        x: bx,
        y: by,
        z: bz,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        intensity: Math.random() * 0.8 + 0.2,
        category: isRoad ? 0 : isCurb ? 1 : isVegetation ? 4 : 2,
      });
    }

    // Dynamic 3D Objects on Road
    const objects: DetectedObject[] = [
      {
        x: -55,
        y: 40,
        z: 140,
        width: 42,
        height: 32,
        depth: 70,
        label: "Sedan (EV Lead)",
        confidence: 99.4,
        color: "#38bdf8", // Sky blue
        type: "vehicle",
      },
      {
        x: 60,
        y: 25,
        z: 220,
        width: 50,
        height: 48,
        depth: 90,
        label: "Autonomous Truck",
        confidence: 98.2,
        color: "#a855f7", // Purple
        type: "truck",
      },
      {
        x: -95,
        y: 60,
        z: 85,
        width: 18,
        height: 38,
        depth: 18,
        label: "Pedestrian",
        confidence: 96.8,
        color: "#34d399", // Emerald
        type: "pedestrian",
      },
      {
        x: 85,
        y: 55,
        z: 110,
        width: 22,
        height: 35,
        depth: 35,
        label: "Cyclist",
        confidence: 97.1,
        color: "#fbbf24", // Amber
        type: "cyclist",
      },
    ];

    // Project 3D point (x, y, z) to 2D Screen coords with perspective
    const focalLength = 320;
    const project = (x: number, y: number, z: number) => {
      const scale = focalLength / (focalLength + z);
      const projX = width / 2 + x * scale;
      const projY = height / 2 + (y - 30) * scale;
      return { x: projX, y: projY, scale };
    };

    const render = (currentTime: number) => {
      // Calculate FPS
      frameCount++;
      if (currentTime - fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = currentTime;
        setPointCount(127500 + Math.floor(Math.random() * 1000));
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Dark Cyberpunk Automotive Perception Canvas Background
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        width * 0.7
      );
      bgGrad.addColorStop(0, "#080e1a");
      bgGrad.addColorStop(0.5, "#030712");
      bgGrad.addColorStop(1, "#020408");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Animated Road Perspective Grid
      roadOffset = (roadOffset + 1.2) % 40;
      ctx.strokeStyle = "rgba(14, 165, 233, 0.12)";
      ctx.lineWidth = 1;

      // Concentric Range Rings (10m, 25m, 50m, 75m)
      const rangeRings = [60, 130, 210, 300];
      rangeRings.forEach((r, idx) => {
        const ringP = project(0, 80, r);
        ctx.beginPath();
        ctx.ellipse(
          width / 2,
          ringP.y,
          r * ringP.scale * 1.5,
          r * ringP.scale * 0.45,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = idx % 2 === 0 ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.1)";
        ctx.stroke();

        // Distance text label
        ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
        ctx.font = "9px monospace";
        ctx.fillText(`${(idx + 1) * 15}m`, width / 2 + r * ringP.scale * 1.5 + 4, ringP.y);
      });

      // 3. Rotating 360° LiDAR Laser Sweep Ray
      angle = (angle + 0.035) % (Math.PI * 2);
      const sweepX = Math.cos(angle) * 320;
      const sweepZ = Math.sin(angle) * 200 + 180;
      const sweepProj = project(sweepX, 70, sweepZ);
      const egoProj = project(0, 85, 0);

      // LiDAR Sweep Cone Beam
      const beamGrad = ctx.createLinearGradient(egoProj.x, egoProj.y, sweepProj.x, sweepProj.y);
      beamGrad.addColorStop(0, "rgba(56, 189, 248, 0.8)");
      beamGrad.addColorStop(0.7, "rgba(56, 189, 248, 0.2)");
      beamGrad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

      ctx.beginPath();
      ctx.moveTo(egoProj.x, egoProj.y);
      ctx.lineTo(sweepProj.x, sweepProj.y);
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Sweep Sector Glow Arc
      ctx.beginPath();
      ctx.moveTo(egoProj.x, egoProj.y);
      const trailAngle = angle - 0.45;
      const trailX = Math.cos(trailAngle) * 320;
      const trailZ = Math.sin(trailAngle) * 200 + 180;
      const trailProj = project(trailX, 70, trailZ);
      ctx.lineTo(trailProj.x, trailProj.y);
      ctx.lineTo(sweepProj.x, sweepProj.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(14, 165, 233, 0.04)";
      ctx.fill();

      // 4. Render Dynamic 3D LiDAR Point Cloud
      points.forEach((p) => {
        // Move points toward camera to simulate forward vehicle driving motion
        p.z -= 1.0;
        if (p.z < 10) {
          p.z = 380;
          p.x = (Math.random() - 0.5) * 600;
        }

        const proj = project(p.x, p.y, p.z);
        if (proj.x < -20 || proj.x > width + 20 || proj.y < -20 || proj.y > height + 20) return;

        // Color coding by active perception view mode
        let color = "#38bdf8";
        if (activeViewMode === "elevation") {
          // Color ramp by Z distance & Y height (Doppler style)
          const ratio = Math.min(1, Math.max(0, (400 - p.z) / 380));
          if (ratio > 0.75) color = "#38bdf8"; // Neon cyan (close)
          else if (ratio > 0.45) color = "#34d399"; // Lime emerald (mid)
          else if (ratio > 0.2) color = "#818cf8"; // Indigo (far)
          else color = "#64748b"; // Slate (horizon)
        } else if (activeViewMode === "intensity") {
          const alpha = p.intensity.toFixed(2);
          color = `rgba(244, 63, 94, ${alpha})`; // Reflectivity red/orange
        } else if (activeViewMode === "segmentation") {
          // Semantic class color
          switch (p.category) {
            case 0:
              color = "#38bdf8"; // Drivable road
              break;
            case 1:
              color = "#f59e0b"; // Curbs & barriers
              break;
            case 4:
              color = "#10b981"; // Vegetation / terrain
              break;
            default:
              color = "#8b5cf6"; // Buildings
          }
        }

        // Check if swept by laser beam
        const pointAngle = Math.atan2(p.z - 180, p.x);
        const diffAngle = Math.abs(pointAngle - (angle % Math.PI));
        const isSwept = diffAngle < 0.15;

        const size = (isSwept ? 2.8 : 1.4) * proj.scale * 1.6;
        ctx.fillStyle = isSwept ? "#ffffff" : color;
        ctx.fillRect(proj.x - size / 2, proj.y - size / 2, size, size);
      });

      // 5. Render 3D Bounding Boxes for Detected Vehicles & Objects
      objects.forEach((obj) => {
        // Animate slight realistic distance oscillation
        const objZ = obj.z + Math.sin(currentTime * 0.0015 + obj.x) * 8;
        const halfW = obj.width / 2;
        const halfH = obj.height / 2;
        const halfD = obj.depth / 2;

        // 8 Vertices of 3D Cuboid Bounding Box
        const corners3D = [
          { x: obj.x - halfW, y: obj.y - halfH, z: objZ - halfD }, // 0: Top Front Left
          { x: obj.x + halfW, y: obj.y - halfH, z: objZ - halfD }, // 1: Top Front Right
          { x: obj.x + halfW, y: obj.y + halfH, z: objZ - halfD }, // 2: Bottom Front Right
          { x: obj.x - halfW, y: obj.y + halfH, z: objZ - halfD }, // 3: Bottom Front Left
          { x: obj.x - halfW, y: obj.y - halfH, z: objZ + halfD }, // 4: Top Rear Left
          { x: obj.x + halfW, y: obj.y - halfH, z: objZ + halfD }, // 5: Top Rear Right
          { x: obj.x + halfW, y: obj.y + halfH, z: objZ + halfD }, // 6: Bottom Rear Right
          { x: obj.x - halfW, y: obj.y + halfH, z: objZ + halfD }, // 7: Bottom Rear Left
        ];

        const corners2D = corners3D.map((c) => project(c.x, c.y, c.z));

        // Draw 3D Cuboid Edges
        const edges = [
          [0, 1], [1, 2], [2, 3], [3, 0], // Front face
          [4, 5], [5, 6], [6, 7], [7, 4], // Rear face
          [0, 4], [1, 5], [2, 6], [3, 7], // Connecting edges
        ];

        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        edges.forEach(([i, j]) => {
          ctx.moveTo(corners2D[i].x, corners2D[i].y);
          ctx.lineTo(corners2D[j].x, corners2D[j].y);
        });
        ctx.stroke();

        // Fill subtle translucent box faces
        ctx.fillStyle = `${obj.color}15`;
        ctx.beginPath();
        ctx.moveTo(corners2D[0].x, corners2D[0].y);
        ctx.lineTo(corners2D[1].x, corners2D[1].y);
        ctx.lineTo(corners2D[2].x, corners2D[2].y);
        ctx.lineTo(corners2D[3].x, corners2D[3].y);
        ctx.closePath();
        ctx.fill();

        // 3D Object Annotation Tag & Confidence Score
        const topCenter = corners2D[0];
        const distanceM = (objZ * 0.15).toFixed(1);

        ctx.fillStyle = "rgba(2, 6, 23, 0.85)";
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 1;
        const tagText = `${obj.label} · ${distanceM}m [${obj.confidence}%]`;
        ctx.font = "bold 9px monospace";
        const textMetrics = ctx.measureText(tagText);
        const tagW = textMetrics.width + 12;
        const tagH = 16;
        const tagX = topCenter.x - tagW / 2;
        const tagY = topCenter.y - 20;

        ctx.fillRect(tagX, tagY, tagW, tagH);
        ctx.strokeRect(tagX, tagY, tagW, tagH);

        ctx.fillStyle = obj.color;
        ctx.fillText(tagText, tagX + 6, tagY + 11);

        // Heading Velocity Vector Arrow
        const headProj = project(obj.x, obj.y - 5, objZ - halfD - 20);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(corners2D[0].x + (corners2D[1].x - corners2D[0].x) / 2, corners2D[0].y + (corners2D[2].y - corners2D[0].y) / 2);
        ctx.lineTo(headProj.x, headProj.y);
        ctx.stroke();
      });

      // 6. Autonomous Vehicle Ego-Car (Sensor Origin)
      const ego = project(0, 95, 20);
      ctx.fillStyle = "rgba(14, 165, 233, 0.3)";
      ctx.beginPath();
      ctx.arc(ego.x, ego.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ego.x, ego.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      // Ego Center Pulse
      const pulseR = (currentTime * 0.04) % 30;
      ctx.strokeStyle = `rgba(56, 189, 248, ${1 - pulseR / 30})`;
      ctx.beginPath();
      ctx.arc(ego.x, ego.y, pulseR, 0, Math.PI * 2);
      ctx.stroke();

      // Ego Label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px monospace";
      ctx.fillText("EGO SENSOR ORIGIN (VLS-128)", ego.x - 72, ego.y + 26);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [activeViewMode]);

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl shadow-sky-500/10 transition-all duration-300 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* HUD Top Bar */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2.5 bg-gradient-to-b from-slate-950/90 to-transparent border-b border-slate-800/60 backdrop-blur-sm text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sky-400 font-semibold tracking-wider">
            <Radio className="w-3.5 h-3.5 animate-pulse text-sky-400" />
            <span>AUTONOMOUS PERCEPTION 3D</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 hidden sm:inline">128-BEAM SPATIAL RAG STREAM</span>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveViewMode("elevation")}
            className={`px-2 py-1 rounded text-[11px] transition ${
              activeViewMode === "elevation"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Elevation (Doppler)
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode("segmentation")}
            className={`px-2 py-1 rounded text-[11px] transition ${
              activeViewMode === "segmentation"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Semantic 3D
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode("intensity")}
            className={`px-2 py-1 rounded text-[11px] transition ${
              activeViewMode === "intensity"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                : "text-slate-400 hover:text-slate-200 border border-transparent"
            }`}
          >
            Reflectivity
          </button>
        </div>
      </div>

      {/* Main Canvas Simulation */}
      <canvas
        ref={canvasRef}
        className="w-full block cursor-crosshair transition-opacity duration-300"
      />

      {/* HUD Bottom Telemetry Bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex flex-wrap items-center justify-between px-4 py-2 bg-gradient-to-t from-slate-950/95 via-slate-950/70 to-transparent border-t border-slate-800/60 backdrop-blur-sm text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-emerald-400 font-semibold">CALIBRATED</span>
          </div>
          <span className="text-slate-400 hidden md:inline">FOV: 360° x 40°</span>
          <span className="text-slate-400 hidden sm:inline">PTS: {pointCount.toLocaleString()} pts/s</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sky-400 font-medium">FPS: {fps}</span>
          <Badge variant="outline" className="text-[10px] border-sky-500/40 bg-sky-950/50 text-sky-300">
            Ground Truth SOP Validated
          </Badge>
        </div>
      </div>
    </div>
  );
}
