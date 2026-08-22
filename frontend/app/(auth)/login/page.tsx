"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Lock, Mail, User, AlertCircle, ArrowRight } from "lucide-react";

function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, signup } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/chat";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error } = await signup(email, password, name);
        if (error) {
          setErrorMessage(error);
          return;
        }
      } else {
        const { error } = await login(email, password);
        if (error) {
          setErrorMessage(error);
          return;
        }
      }
      router.push(redirectPath);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword("Autocruise2026!");
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { error } = await login(demoEmail, "Autocruise2026!");
      if (error) {
        setErrorMessage(error);
      } else {
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : `Failed demo login as ${demoRole}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-800 bg-slate-900/90 backdrop-blur shadow-2xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl text-white">
          {isSignUp ? "Create ARIA Account" : "Sign in to workspace"}
        </CardTitle>
        <CardDescription className="text-slate-400 text-xs">
          {isSignUp
            ? "Enter your details to join your organization's LiDAR workspace."
            : "Enter your enterprise credentials to access protected projects."}
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Rivera"
                className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Enterprise Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@autocruise.example.com"
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-medium py-2 rounded-md shadow-lg shadow-sky-500/20 transition flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying session...</span>
              </>
            ) : (
              <>
                <span>{isSignUp ? "Register Account" : "Access ARIA Workspace"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </CardContent>
      </form>

      <CardFooter className="flex flex-col space-y-4 pt-2 border-t border-slate-800">
        {/* Toggle sign in / sign up */}
        <div className="text-center text-xs text-slate-400">
          {isSignUp ? "Already have an enterprise account?" : "Need to request new account access?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMessage(null);
            }}
            className="text-sky-400 hover:underline font-medium ml-1"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </div>

        {/* Quick Demo Sign-in for the 7 Roles */}
        <div className="w-full pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Demo Roles Quick-Login
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleDemoLogin("deenathedev@protonmail.com", "SUPER_ADMIN")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Deena</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-500/40 text-purple-400 bg-purple-950/40">
                SUPER_ADMIN
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("sarah.chen@autocruise.example.com", "ADMIN")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-blue-500/50 hover:bg-blue-950/20 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Sarah</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-500/40 text-blue-400 bg-blue-950/40">
                ADMIN
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("alex.rivera@autocruise.example.com", "ANNOTATOR")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Alex</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/40 text-emerald-400 bg-emerald-950/40">
                ANNOTATOR
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("marcus.vance@autocruise.example.com", "QC")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Marcus</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/40 text-amber-400 bg-amber-950/40">
                QC
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("elena.rostova@autocruise.example.com", "VALIDATOR")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-teal-500/50 hover:bg-teal-950/20 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Dr. Elena</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-teal-500/40 text-teal-400 bg-teal-950/40">
                VALIDATOR
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin("maya.patel@autocruise.example.com", "VIEWER")}
              className="px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-500/50 hover:bg-slate-800 text-left transition flex items-center justify-between"
            >
              <span className="text-slate-300 font-medium text-[11px]">Maya</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-slate-600 text-slate-400 bg-slate-900">
                VIEWER
              </Badge>
            </button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]" />

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xl ring-2 ring-sky-500/30 mb-2">
            <Image
              src="/aria-logo.jpg"
              alt="ARIA Logo"
              fill
              className="object-cover"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            ARIA
            <Badge variant="outline" className="text-xs text-sky-400 border-sky-500/40 bg-sky-950/40">
              v0.1.0
            </Badge>
          </h1>
          <p className="text-sm text-slate-400 max-w-xs">
            Annotation RAG Intelligence Assistant for 3D LiDAR & Autonomous Perception
          </p>
        </div>

        {/* Suspense boundary for Next.js App Router prerendering */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
