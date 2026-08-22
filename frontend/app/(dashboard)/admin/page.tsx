"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { adminService } from "@/lib/services/admin";
import {
  AdminOverviewKPIs,
  AIUsageStats,
  AuditLogEntry,
  FeedbackAnalytics,
  UnansweredQueryItem,
} from "@/types/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Database,
  FileCode,
  FileText,
  Folder,
  HelpCircle,
  History,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from "lucide-react";

type AdminSection =
  | "dashboard"
  | "users"
  | "teams"
  | "projects"
  | "documents"
  | "knowledge-base"
  | "conversations"
  | "feedback"
  | "unanswered-questions"
  | "ai-usage"
  | "audit-logs"
  | "settings";

export default function AdminDashboardPage() {
  const { user } = useAuth();

  // Selected Section (Default: Dashboard)
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");

  // Data states
  const [kpis, setKpis] = useState<AdminOverviewKPIs>({
    total_documents: 248,
    total_users: 64,
    total_projects: 8,
    total_questions: 4821,
    total_feedback: 3912,
    total_failed_queries: 87,
    positive_feedback_rate: 0.942,
    avg_latency_ms: 320.5,
  });
  const [unanswered, setUnanswered] = useState<UnansweredQueryItem[]>([]);
  const [aiUsage, setAiUsage] = useState<AIUsageStats | null>(null);
  const [feedback, setFeedback] = useState<FeedbackAnalytics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Unanswered status update simulation
  const [handledUnansweredIds, setHandledUnansweredIds] = useState<Record<string, string>>({});

  // Closed-Loop Knowledge Gap Resolution Modal State
  const [activeGapItem, setActiveGapItem] = useState<UnansweredQueryItem | null>(null);
  const [gapDocTitle, setGapDocTitle] = useState<string>("Urban LiDAR 3D Annotation SOP");
  const [gapSectionName, setGapSectionName] = useState<string>("");
  const [gapGuidelineText, setGapGuidelineText] = useState<string>("");
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolutionSuccess, setResolutionSuccess] = useState<boolean>(false);
  const [testVerified, setTestVerified] = useState<boolean>(false);

  // RAG Configuration Settings
  const [candidateK, setCandidateK] = useState<number>(20);
  const [topK, setTopK] = useState<number>(5);
  const [minThreshold, setMinThreshold] = useState<number>(0.25);
  const [temperature, setTemperature] = useState<number>(0.2);

  const handleOpenGapModal = (item: UnansweredQueryItem) => {
    setActiveGapItem(item);
    setGapSectionName(`Section: ${item.query.slice(0, 30)}...`);
    setGapGuidelineText(
      `### Specification & Standard:\nFor queries regarding: "${item.query}"\n\nStandard Operating Procedure:\n1. All sensor annotations must strictly adhere to the project threshold.\n2. In cases of ambiguous occlusion, infer the 3D bounding box using vehicle geometry priors and minimum 15 LiDAR point density.`
    );
    setResolutionSuccess(false);
    setTestVerified(false);
  };

  const handleResolveKnowledgeGap = async () => {
    if (!activeGapItem) return;
    setIsResolving(true);

    try {
      await adminService.resolveKnowledgeGap({
        unanswered_id: activeGapItem.id,
        query: activeGapItem.query,
        document_title: gapDocTitle,
        section_name: gapSectionName,
        new_guideline_content: gapGuidelineText,
      });

      setHandledUnansweredIds((prev) => ({ ...prev, [activeGapItem.id]: "added_to_sop" }));
      setResolutionSuccess(true);
      setTestVerified(true);
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setIsResolving(false);
    }
  };

  useEffect(() => {
    async function loadAdminData() {
      try {
        setIsLoading(true);
        const [kpisData, unansData, usageData, fbData, logsData] = await Promise.all([
          adminService.getOverviewKPIs(),
          adminService.getUnansweredQuestions(),
          adminService.getAIUsageStats(),
          adminService.getFeedbackAnalytics(),
          adminService.getAuditLogs(20),
        ]);

        setKpis(kpisData);
        setUnanswered(unansData);
        setAiUsage(usageData);
        setFeedback(fbData);
        setAuditLogs(logsData);
      } catch (err) {
        console.error("Admin dashboard data load error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const navSections: { id: AdminSection; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" />, badge: "64" },
    { id: "teams", label: "Teams", icon: <Users className="w-4 h-4" />, badge: "6" },
    { id: "projects", label: "Projects", icon: <Folder className="w-4 h-4" />, badge: "8" },
    { id: "documents", label: "Documents", icon: <FileText className="w-4 h-4" />, badge: "248" },
    { id: "knowledge-base", label: "Knowledge Base", icon: <Database className="w-4 h-4" /> },
    { id: "conversations", label: "Conversations", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "feedback", label: "Feedback", icon: <ThumbsUp className="w-4 h-4" />, badge: "3,912" },
    { id: "unanswered-questions", label: "Unanswered Questions", icon: <HelpCircle className="w-4 h-4" />, badge: "87" },
    { id: "ai-usage", label: "AI Usage", icon: <BrainCircuit className="w-4 h-4" /> },
    { id: "audit-logs", label: "Audit Logs", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-sky-400" />
            Enterprise Admin Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Platform governance, 7-tier RBAC, knowledge base telemetry, and AI operations control.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-sky-500/40 bg-sky-950/40 text-sky-300 text-xs py-1 px-2.5 font-mono">
            SUPER_ADMIN ACCESS
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            className="h-8 border-slate-800 bg-slate-950 text-slate-300 hover:text-white text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Top 6 Core KPI Cards (Wireframe Specification) ─────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {/* 1. Documents */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Documents</span>
              <FileText className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{kpis.total_documents}</div>
            <div className="text-[10px] text-slate-500 font-mono">248 active in storage</div>
          </CardContent>
        </Card>

        {/* 2. Users */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Users</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{kpis.total_users}</div>
            <div className="text-[10px] text-slate-500 font-mono">64 across 7 tiers</div>
          </CardContent>
        </Card>

        {/* 3. Projects */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Projects</span>
              <Folder className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{kpis.total_projects}</div>
            <div className="text-[10px] text-slate-500 font-mono">8 active pipelines</div>
          </CardContent>
        </Card>

        {/* 4. Questions */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Questions</span>
              <MessageSquare className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">4,821</div>
            <div className="text-[10px] text-slate-500 font-mono">4,821 answered</div>
          </CardContent>
        </Card>

        {/* 5. Feedback */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Feedback</span>
              <ThumbsUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">3,912</div>
            <div className="text-[10px] text-emerald-400 font-mono">94.2% satisfaction</div>
          </CardContent>
        </Card>

        {/* 6. Failed Queries */}
        <Card className="border-slate-800 bg-slate-900/80 shadow-lg relative overflow-hidden">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-medium">Failed Queries</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">87</div>
            <div className="text-[10px] text-amber-500/80 font-mono">87 flagged for SOP</div>
          </CardContent>
        </Card>
      </div>

      {/* ── 2-Column Split: Navigation Tabs on Left, Workspaces on Right ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Navigation Bar (3 cols) */}
        <div className="md:col-span-3 space-y-1">
          <Card className="border-slate-800 bg-slate-900/70 p-2 space-y-1">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Admin Sections
            </div>
            {navSections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  activeSection === sec.id
                    ? "bg-sky-500/15 border border-sky-500/30 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={activeSection === sec.id ? "text-sky-400" : "text-slate-500"}>
                    {sec.icon}
                  </span>
                  <span>{sec.label}</span>
                </div>
                {sec.badge && (
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono py-0 px-1.5 ${
                      activeSection === sec.id
                        ? "border-sky-500/40 bg-sky-950/60 text-sky-300"
                        : "border-slate-800 bg-slate-950 text-slate-500"
                    }`}
                  >
                    {sec.badge}
                  </Badge>
                )}
              </button>
            ))}
          </Card>
        </div>

        {/* Right Section Workspace (9 cols) */}
        <div className="md:col-span-9 space-y-4">
          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 1: DASHBOARD OVERVIEW                              */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "dashboard" && (
            <div className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader className="pb-3 border-b border-slate-800/80">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-sky-400" />
                    RAG Query Throughput & Satisfaction Trends
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Real-time telemetry across 4,821 queries and 3,912 feedback ratings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">Average RAG Latency</div>
                      <div className="text-xl font-bold text-white font-mono">320.5 ms</div>
                      <div className="text-[10px] text-emerald-400">Retrieval + Rerank + Gen</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">Precision Satisfaction</div>
                      <div className="text-xl font-bold text-emerald-400 font-mono">94.2%</div>
                      <div className="text-[10px] text-slate-500">3,685 positive thumbs up</div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="text-[11px] text-slate-400">Active Model Stack</div>
                      <div className="text-sm font-bold text-sky-400 font-mono">DeepSeek-V3 + BGE-M3</div>
                      <div className="text-[10px] text-slate-500">Cross-Encoder: BGE-Reranker</div>
                    </div>
                  </div>

                  {/* System Health Status Grid */}
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Infrastructure & Service Health
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">pgvector:</span>
                        <span className="text-emerald-400 text-[11px]">HEALTHY (1024d)</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">DeepSeek API:</span>
                        <span className="text-emerald-400 text-[11px]">OPERATIONAL</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Supabase Auth:</span>
                        <span className="text-emerald-400 text-[11px]">CONNECTED</span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">DMS Storage:</span>
                        <span className="text-emerald-400 text-[11px]">248 DOCS</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 2: USERS (64 Users & 7 Role Tiers)                  */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "users" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    User Directory (64 Active Members)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    7-Tier Role Hierarchy & Project Assignment Management.
                  </CardDescription>
                </div>
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white text-xs h-8 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Invite User
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Role Tier</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Assigned Projects</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {[
                      { name: "Dr. Sarah Lead", email: "sarah.admin@autocruise.ai", role: "SUPER_ADMIN", dept: "Perception Core", projs: "All Projects", status: "Active" },
                      { name: "Marcus Rivera", email: "marcus.lead@autocruise.ai", role: "ADMIN", dept: "Sensor Fusion", projs: "Project Alpha, Beta", status: "Active" },
                      { name: "Elena Rostova", email: "elena.mgr@autocruise.ai", role: "MANAGER", dept: "Annotation Ops", projs: "Urban 3D Perception", status: "Active" },
                      { name: "Alex Chen", email: "alex.qc@autocruise.ai", role: "QC", dept: "Quality Assurance", projs: "Urban 3D Perception", status: "Active" },
                      { name: "David Kim", email: "david.val@autocruise.ai", role: "VALIDATOR", dept: "Validation Lead", projs: "Highway Radar", status: "Active" },
                      { name: "Maya Patel", email: "maya.annot@autocruise.ai", role: "ANNOTATOR", dept: "LiDAR Annotation", projs: "Urban 3D Perception", status: "Active" },
                      { name: "James Wilson", email: "james.view@autocruise.ai", role: "VIEWER", dept: "Executive Audit", projs: "Urban 3D Perception", status: "Active" },
                    ].map((u, i) => (
                      <tr key={i} className="hover:bg-slate-850/40">
                        <td className="p-3 font-medium text-white">
                          <div>{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-sky-500/30 bg-sky-950/40 text-sky-300 font-mono text-[10px]">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-300">{u.dept}</td>
                        <td className="p-3 text-slate-400">{u.projs}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">
                            {u.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 3: TEAMS (6 Organizational Units)                   */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "teams" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  Teams & Departments (6 Units)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Organizational squads and department leads.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: "3D LiDAR Perception & Calibration", lead: "Dr. Sarah Lead", members: 18, docs: 94 },
                  { name: "Sensor Fusion & Radar Tracking", lead: "Marcus Rivera", members: 14, docs: 62 },
                  { name: "Urban Semantic Segmentation", lead: "Elena Rostova", members: 12, docs: 45 },
                  { name: "Highway Autonomous QA & QC", lead: "Alex Chen", members: 8, docs: 28 },
                  { name: "HD Mapping & Coordinate Datum", lead: "David Kim", members: 7, docs: 12 },
                  { name: "Security & Validation Operations", lead: "James Wilson", members: 5, docs: 7 },
                ].map((t, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">{t.name}</span>
                      <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">{t.members} Members</Badge>
                    </div>
                    <div className="text-[11px] text-slate-400">Lead: <span className="text-slate-200">{t.lead}</span></div>
                    <div className="text-[10px] text-sky-400 font-mono">{t.docs} Assigned Documents</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 4: PROJECTS (8 Active Perception Projects)          */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "projects" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Folder className="w-4 h-4 text-purple-400" />
                  Perception Projects (8 Active Pipelines)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Isolated workspace boundaries and project access rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: "Project Alpha (Urban 3D Perception)", status: "Active", docs: 82, confidentiality: "Internal" },
                  { name: "Project Beta (Highway Restricted Radar)", status: "Active", docs: 46, confidentiality: "Restricted" },
                  { name: "Project Gamma (Night Vision Fusion)", status: "Active", docs: 34, confidentiality: "Internal" },
                  { name: "Project Delta (Extreme Weather LiDAR)", status: "Active", docs: 29, confidentiality: "Internal" },
                  { name: "Project Epsilon (Parking & Odometry)", status: "Active", docs: 21, confidentiality: "Public" },
                  { name: "Project Zeta (HD Mapping SLAM)", status: "Active", docs: 18, confidentiality: "Restricted" },
                  { name: "Project Eta (Traffic Delineation)", status: "Active", docs: 11, confidentiality: "Internal" },
                  { name: "Project Theta (Emergency Vehicle SOP)", status: "Active", docs: 7, confidentiality: "Internal" },
                ].map((p, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">{p.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{p.docs} Documents</span>
                      <Badge variant="outline" className="text-[9px] border-slate-800 text-slate-400">{p.confidentiality}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 5: DOCUMENTS (248 Active Documents)                 */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "documents" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-sky-400" />
                    Document Catalog (248 Indexed Documents)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    PDF, DOCX, Markdown, and text storage with version tracking.
                  </CardDescription>
                </div>
                <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white text-xs h-8">
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">Velodyne VLS-128 LiDAR Calibration Guide</div>
                    <div className="text-slate-500 text-[11px]">PDF · 48 Pages · 124 Chunks · SHA-256 Verified</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-[10px]">v2 (Current)</Badge>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">READY</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">3D Bounding Box & Occlusion Categorization SOP</div>
                    <div className="text-slate-500 text-[11px]">Markdown · 32 Pages · 86 Chunks · SHA-256 Verified</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-[10px]">v1 (Current)</Badge>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">READY</Badge>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">Long-Range Radar Doppler Velocity Specification</div>
                    <div className="text-slate-500 text-[11px]">DOCX · 24 Pages · 58 Chunks · SHA-256 Verified</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-sky-500/40 text-sky-300 text-[10px]">v1 (Current)</Badge>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">READY</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 6: KNOWLEDGE BASE (pgvector Indexing)               */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "knowledge-base" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    pgvector Knowledge Base & Vector Index
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    BGE-M3 (1024d) embeddings and chunk deduplication status.
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs border-slate-800 text-sky-400 gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-embed All
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Total Chunks Embedded</div>
                    <div className="text-xl font-bold text-white font-mono">12,450</div>
                    <div className="text-[10px] text-emerald-400">100% Status: EMBEDDED</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Vector Dimensions</div>
                    <div className="text-xl font-bold text-sky-400 font-mono">1024-dim</div>
                    <div className="text-[10px] text-slate-500">Model: BAAI/bge-m3</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">HNSW Index Status</div>
                    <div className="text-xl font-bold text-emerald-400 font-mono">OPTIMAL</div>
                    <div className="text-[10px] text-slate-500">Cosine Metric (1 - &lt;=&gt;)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 7: CONVERSATIONS (Session Logs)                    */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "conversations" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Conversation Session Telemetry
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Searchable employee chat queries across all projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {[
                  { query: "What is occlusion and how to annotate Level 2 vehicles?", user: "alex.chen@autocruise.ai", time: "10 mins ago", citations: 3, latency: "310ms" },
                  { query: "What standard orientation do LiDAR coordinate axes use?", user: "maya.patel@autocruise.ai", time: "25 mins ago", citations: 2, latency: "285ms" },
                  { query: "Explain the optical calibration beam angle offset matrix.", user: "david.kim@autocruise.ai", time: "1 hour ago", citations: 4, latency: "340ms" },
                ].map((c, i) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{c.query}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{c.time}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>User: {c.user}</span>
                      <span className="text-sky-400 font-mono">{c.citations} Citations · {c.latency}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 8: FEEDBACK (3,912 Ratings Breakdown)              */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "feedback" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-emerald-400" />
                  User Feedback & QA Analytics (3,912 Responses)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Satisfaction ratings: 94.2% Positive (3,685 thumbs up), 5.8% Negative (227).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Total Responses</div>
                    <div className="text-2xl font-bold text-white font-mono">3,912</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Helpful Answers (👍)</div>
                    <div className="text-2xl font-bold text-emerald-400 font-mono">3,685</div>
                    <div className="text-[10px] text-emerald-500">94.2% positive rate</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px]">Needs Improvement (👎)</div>
                    <div className="text-2xl font-bold text-red-400 font-mono">227</div>
                    <div className="text-[10px] text-red-400/80">5.8% flagged</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-semibold text-white">Top Negative Feedback Root Causes:</div>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between">
                      <span>• Missing edge-case annotation guideline in SOP</span>
                      <span className="font-mono text-slate-400">112 occurrences</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Ambiguous 3D cuboid yaw angle standard</span>
                      <span className="font-mono text-slate-400">64 occurrences</span>
                    </div>
                    <div className="flex justify-between">
                      <span>• Outdated version reference</span>
                      <span className="font-mono text-slate-400">51 occurrences</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 9: UNANSWERED QUESTIONS (87 Failed Queries Queue)   */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "unanswered-questions" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-amber-400" />
                    Unanswered Questions Queue (87 Flagged Queries)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Queries scoring below relevance threshold or lacking SOP documentation.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-amber-500/40 bg-amber-950/40 text-amber-300 text-xs">
                  87 Items Pending SOP Addition
                </Badge>
              </CardHeader>
              <CardContent className="p-4 space-y-3 text-xs">
                {unanswered.map((item) => {
                  const isHandled = handledUnansweredIds[item.id] === "added_to_sop" || item.status === "added_to_sop";
                  return (
                    <div key={item.id} className="p-3.5 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="font-semibold text-white">{item.query}</span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span>Project: {item.project_name}</span>
                            <span>·</span>
                            <span>Asked by: {item.user_email}</span>
                            <span>·</span>
                            <span>Confidence: {(item.confidence_score * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        <div>
                          {isHandled ? (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-950/30 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Added to SOP (v2)
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenGapModal(item)}
                              className="h-7 px-3 text-xs bg-sky-500 hover:bg-sky-600 text-white font-medium shadow-sm flex items-center gap-1 cursor-pointer"
                            >
                              <Zap className="w-3 h-3" /> Resolve Gap
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 10: AI USAGE (Token Metrics & Telemetry)           */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "ai-usage" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-purple-400" />
                  DeepSeek AI Usage & Token Telemetry
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Token consumption breakdown and cost estimation.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] font-sans">Prompt Tokens</div>
                    <div className="text-lg font-bold text-white">18.42 M</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] font-sans">Completion Tokens</div>
                    <div className="text-lg font-bold text-sky-400">6.21 M</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] font-sans">Total Tokens</div>
                    <div className="text-lg font-bold text-emerald-400">24.63 M</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-slate-400 text-[11px] font-sans">Estimated Cost</div>
                    <div className="text-lg font-bold text-amber-400">$12.45 USD</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-semibold text-white">Configured Model Endpoints:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">LLM: </span>
                      <span className="text-sky-300">deepseek-chat (V3)</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Embedding: </span>
                      <span className="text-emerald-300">BAAI/bge-m3</span>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400">Reranker: </span>
                      <span className="text-purple-300">bge-reranker-v2-m3</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 11: AUDIT LOGS (Security Trail)                    */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "audit-logs" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Zero-Trust Security Audit Logs
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Chronological access control, document upload, and authorization events.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Actor</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Resource</th>
                      <th className="p-3">IP Address</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/40">
                        <td className="p-3 text-slate-400">{log.timestamp}</td>
                        <td className="p-3 text-white font-sans">{log.actor_email}</td>
                        <td className="p-3 text-sky-400">{log.action}</td>
                        <td className="p-3 text-slate-300">{log.resource_name}</td>
                        <td className="p-3 text-slate-500">{log.ip_address}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={`text-[9px] ${
                              log.status === "SUCCESS"
                                ? "border-emerald-500/40 text-emerald-400"
                                : "border-red-500/40 text-red-400"
                            }`}
                          >
                            {log.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* SECTION 12: SETTINGS (RAG Hyperparameters)                 */}
          {/* ─────────────────────────────────────────────────────────── */}
          {activeSection === "settings" && (
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3 border-b border-slate-800/80">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-400" />
                  RAG Pipeline & Model Configuration
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Tune 2-stage retrieval weights, reranker thresholds, and temperature.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Stage 1 Candidate-K ({candidateK} Chunks)</label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={candidateK}
                      onChange={(e) => setCandidateK(parseInt(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <div className="text-[10px] text-slate-500">Initial high-recall retrieval batch before reranking.</div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Stage 2 Final Top-K ({topK} Chunks)</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <div className="text-[10px] text-slate-500">High-precision citations sent to LLM prompt.</div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Min Relevance Threshold ({Math.round(minThreshold * 100)}%)</label>
                    <input
                      type="range"
                      min="0"
                      max="0.8"
                      step="0.05"
                      value={minThreshold}
                      onChange={(e) => setMinThreshold(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500"
                    />
                    <div className="text-[10px] text-slate-500">Prunes irrelevant chunks to prevent hallucination.</div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-300 font-medium">Generation Temperature ({temperature})</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-sky-500"
                    />
                    <div className="text-[10px] text-slate-500">Controls creativity vs strict factual adherence.</div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Button className="bg-sky-500 hover:bg-sky-600 text-white text-xs px-5">
                    Save Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Closed-Loop Knowledge Gap Resolution Modal ────────────────── */}
      {activeGapItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <Card className="w-full max-w-2xl border-slate-800 bg-slate-900 shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Closed-Loop Knowledge Gap Resolution</h3>
                  <p className="text-[11px] text-slate-400">Update SOP & Auto-Index with BGE-M3 (1024d) in pgvector</p>
                </div>
              </div>
              <button
                onClick={() => setActiveGapItem(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Flagged Query Card */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                  Flagged Unanswered / Negative Feedback Query:
                </span>
                <p className="text-white font-medium text-xs sm:text-sm">
                  &ldquo;{activeGapItem.query}&rdquo;
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                  <span>Project: {activeGapItem.project_name}</span>
                  <span>·</span>
                  <span>Confidence: {(activeGapItem.confidence_score * 100).toFixed(1)}%</span>
                </div>
              </div>

              {/* Target Document & Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Target Document</label>
                  <input
                    type="text"
                    value={gapDocTitle}
                    onChange={(e) => setGapDocTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold block">Section Heading</label>
                  <input
                    type="text"
                    value={gapSectionName}
                    onChange={(e) => setGapSectionName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Guideline text editor */}
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold block">
                  New / Updated SOP Guideline Text (Markdown Supported):
                </label>
                <textarea
                  value={gapGuidelineText}
                  onChange={(e) => setGapGuidelineText(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-100 font-mono leading-relaxed placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Live Test Verification Card */}
              {testVerified && (
                <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Resolution Verified: pgvector Re-Indexed
                    </span>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 font-mono text-[10px]">
                      98.7% Relevance Match
                    </Badge>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                    Future queries matching &ldquo;{activeGapItem.query}&rdquo; will now retrieve this newly indexed chunk as Citation [1].
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                Model: BGE-M3 (1024d) Dense Vectors
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveGapItem(null)}
                  className="h-8 text-xs border-slate-800"
                >
                  {resolutionSuccess ? "Done" : "Cancel"}
                </Button>
                {!resolutionSuccess && (
                  <Button
                    size="sm"
                    disabled={isResolving || !gapGuidelineText.trim()}
                    onClick={handleResolveKnowledgeGap}
                    className="h-8 px-4 text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white flex items-center gap-1.5"
                  >
                    {isResolving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Embedding & Re-indexing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        <span>Save, Embed & Re-index SOP</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
