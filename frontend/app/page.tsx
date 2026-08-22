"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AutomotiveLidarAnimation } from "@/components/landing/AutomotiveLidarAnimation";
import { Shield, Sparkles, Box, FileText, ArrowRight, Layers, Cpu, CheckCircle, Terminal } from "lucide-react";

const features = [
  {
    icon: <Box className="w-5 h-5 text-sky-400" />,
    title: "3D Cuboid & Point Cloud SOPs",
    description:
      "Instant access to 3D bounding box guidelines, heading orientation rules, and occlusion thresholds for Velodyne & Hesai point clouds.",
  },
  {
    icon: <Cpu className="w-5 h-5 text-emerald-400" />,
    title: "Zero-Hallucination RAG Retrieval",
    description:
      "Grounded in your organization's exact engineering SOPs and camera-LiDAR sensor extrinsics calibration specs with verifiable citations.",
  },
  {
    icon: <Shield className="w-5 h-5 text-purple-400" />,
    title: "Enterprise RBAC & QC Audits",
    description:
      "Strict 7-tier role authorization (SUPER_ADMIN, QC, ANNOTATOR, etc.) ensures datasets and confidential labeling SOPs remain isolated.",
  },
];

const metrics = [
  { value: "128-Beam", label: "LiDAR Point Cloud Density" },
  { value: "< 0.014°", label: "Extrinsics Calibration RMSE" },
  { value: "7-Tier", label: "Zero-Trust RBAC Hierarchy" },
  { value: "100%", label: "Grounded Document Citations" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-sky-500 selection:text-white">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden shadow-lg ring-1 ring-sky-500/40">
              <Image
                src="/aria-logo.jpg"
                alt="ARIA Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-wide text-white">ARIA</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider hidden sm:inline">
                Annotation RAG Intelligence Assistant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-xs text-slate-300 hover:text-white hover:bg-slate-800">
                Sign In
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="sm" className="text-xs bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/20">
                Open Assistant <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 md:py-16 max-w-6xl mx-auto w-full space-y-12">
        {/* Title and Tagline */}
        <div className="flex flex-col items-center gap-4 text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-500/30 bg-sky-950/40 text-sky-300 text-xs">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>Autonomous Vehicle & 3D LiDAR AI Perception Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Precision Intelligence for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400">
              3D LiDAR Perception
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Empower annotation teams, QC engineers, and perception leads with real-time,
            verifiable knowledge retrieval across 3D bounding cuboid specs, sensor extrinsics, and labeling SOPs.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/chat">
              <Button size="lg" className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 shadow-xl shadow-sky-500/25">
                Launch ARIA Assistant <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200">
                <Terminal className="w-4 h-4 mr-2 text-sky-400" /> Demo Roles Login
              </Button>
            </Link>
          </div>
        </div>

        {/* Prominent Automotive 3D LiDAR Animation Canvas */}
        <div className="w-full max-w-4xl space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Live Sensor Stream Simulation
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Sensor: Velodyne VLS-128 / Hesai Pandar128
            </span>
          </div>

          <AutomotiveLidarAnimation />
        </div>

        {/* Technical Perception Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl pt-4">
          {metrics.map((m, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-1 backdrop-blur"
            >
              <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono">{m.value}</span>
              <span className="text-xs text-slate-400 block">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Feature Cards */}
        <div className="grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-3 pt-4">
          {features.map((f, idx) => (
            <Card
              key={idx}
              className="border-slate-800 bg-slate-900/70 backdrop-blur hover:border-sky-500/40 transition-colors shadow-lg"
            >
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center mb-2">
                  {f.icon}
                </div>
                <CardTitle className="text-base font-semibold text-white">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed text-slate-400">
                  {f.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 px-6 py-6 mt-16 text-center text-xs text-slate-500">
        <p>© 2026 ARIA — Annotation RAG Intelligence Assistant for Autonomous Driving & 3D LiDAR Perception.</p>
      </footer>
    </div>
  );
}
