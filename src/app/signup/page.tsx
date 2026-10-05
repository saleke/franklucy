"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  Building2,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<"OWNER" | "MANAGER" | "CASHIER" | "STOCKKEEPER" | "SALESPERSON">("OWNER");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch active branches for the dropdown
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch("/api/auth/branches");
        if (res.ok) {
          const data = await res.json();
          if (data.branches && data.branches.length > 0) {
            setBranches(data.branches);
            setBranchId(data.branches[0].id);
          }
        }
      } catch {
        // Fallback default
      }
    }
    loadBranches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          role,
          phone,
          branchId: branchId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account.");
        setIsLoading(false);
        return;
      }

      // Successful registration & immediate session establishment
      router.push("/today");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex flex-col justify-center py-10 sm:px-6 lg:px-8 overflow-hidden">
      {/* Ambient background lighting mesh */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gradient-to-tr from-sky-500/10 via-brand/10 to-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -left-20 w-80 h-80 bg-brand/5 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-lg flex flex-col items-center text-center relative z-10">
        {/* Brand Header */}
        <BrandLogo size="xl" subtitle="Staff & Management Portal" className="mb-2" />
        <h2 className="text-xl font-black tracking-tight text-text-primary mt-1">
          Create Your Commercial Account
        </h2>
        <p className="mt-1 text-xs text-text-secondary max-w-md">
          Join FrankLucy with your operational role and branch assignment
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0 relative z-10">
        <div className="bg-surface/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5 relative overflow-hidden">
          {/* Subtle top specular sheen */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  First Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ade"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Adeleke"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="ade@franklucy.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Phone (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                Operational Role *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "OWNER", label: "👑 Owner", desc: "Global Oversight" },
                  { id: "SALESPERSON", label: "🛍️ Sales Person", desc: "POS & Stock Intake" },
                  { id: "MANAGER", label: "👔 Manager", desc: "Branch Supervisor" },
                  { id: "CASHIER", label: "💳 Cashier", desc: "POS & Sales Only" },
                  { id: "STOCKKEEPER", label: "📦 Stockkeeper", desc: "Inventory & GR" },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id as any)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      role === r.id
                        ? "bg-brand/20 border-brand text-brand ring-1 ring-brand shadow-xs"
                        : "bg-surface-elevated/40 border-white/5 text-text-secondary hover:border-white/20 hover:bg-surface-elevated"
                    }`}
                  >
                    <div className="font-bold text-xs text-text-primary">{r.label}</div>
                    <div className="text-[10px] text-text-muted mt-0.5 leading-tight">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Branch Assignment */}
            {branches.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Assigned Branch *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-surface-elevated/50 text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Password Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-text-muted absolute left-3 top-3 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-10 pl-9 pr-10 rounded-lg border border-border bg-surface-elevated/50 text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 mt-3 rounded-lg bg-brand hover:bg-brand-hover text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-brand/25 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Sign In */}
          <div className="pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-text-secondary">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-brand hover:text-brand-hover font-bold transition-colors underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
