"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@franklucy.com");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, password: targetPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed.");
        setIsLoading(false);
        return;
      }

      router.push("/today");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred.");
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const setDemoAccount = async (roleEmail: string, immediateLogin = false) => {
    setEmail(roleEmail);
    setPassword("Password123!");
    setError(null);
    if (immediateLogin) {
      await performLogin(roleEmail, "Password123!");
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col justify-center py-12 sm:px-6 lg:px-8 overflow-hidden">
      {/* Ambient background lighting mesh */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-sky-500/10 via-brand/10 to-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-20 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center text-center relative z-10">
        {/* Brand Header */}
        <BrandLogo size="xl" subtitle="Commercial Operations Platform" className="mb-2" />
        <p className="mt-2 text-xs text-text-secondary max-w-sm">
          Multi-branch commercial operations, point of sale & inventory ledger
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <div className="bg-surface/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle top specular sheen */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {error && (
            <div className="mb-5 flex items-center gap-2.5 p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@franklucy.com"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-10 pl-9 pr-10 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-2 rounded-lg bg-brand hover:bg-brand-hover text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-brand/25 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <p className="text-xs text-text-secondary">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="text-brand hover:text-brand-hover font-bold transition-colors underline"
                >
                  Create an account / Sign up
                </Link>
              </p>
            </div>
          </form>

          {/* Quick Role Switcher */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                <span>Instant 1-Click Test Access</span>
              </div>
              <span className="text-[10px] text-brand font-medium">Click to enter</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoAccount("owner@franklucy.com", true)}
                className="p-2.5 rounded-lg border border-white/5 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-amber-400/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text-primary group-hover:text-amber-300 transition-colors">👑 Owner</p>
                  <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-amber-300 transition-colors" />
                </div>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  Global Oversight
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("manager@franklucy.com", true)}
                className="p-2.5 rounded-lg border border-white/5 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-sky-400/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text-primary group-hover:text-sky-300 transition-colors">👔 Manager</p>
                  <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-sky-300 transition-colors" />
                </div>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  Branch Control
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("cashier@franklucy.com", true)}
                className="p-2.5 rounded-lg border border-white/5 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-emerald-400/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text-primary group-hover:text-emerald-300 transition-colors">💳 Cashier</p>
                  <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-emerald-300 transition-colors" />
                </div>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  POS & Sales
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount("stock@franklucy.com", true)}
                className="p-2.5 rounded-lg border border-white/5 bg-surface-elevated/40 hover:bg-surface-elevated hover:border-purple-400/40 text-left transition-all group"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-text-primary group-hover:text-purple-300 transition-colors">📦 Stockkeeper</p>
                  <ArrowRight className="w-3 h-3 text-text-muted group-hover:text-purple-300 transition-colors" />
                </div>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  Warehouse
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
