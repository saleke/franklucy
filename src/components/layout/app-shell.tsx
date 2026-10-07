"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  ArrowLeftRight,
  Users,
  Clock,
  ShieldAlert,
  Banknote,
  ChevronDown,
  LogOut,
  Building2,
  Menu,
  X,
  Search,
  Check,
  Settings,
  Loader2,
} from "lucide-react";
import { SessionUser } from "@/lib/auth";

import { BrandLogo } from "@/components/ui/brand-logo";

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ user, children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSwitchingBranch, setIsSwitchingBranch] = useState(false);
  const [navigatingHref, setNavigatingHref] = useState<string | null>(null);

  // Categorized navigation structure with role-based filtering
  const navSections = [
    {
      title: "Core Operations",
      items: [
        {
          name: "Today",
          href: "/today",
          icon: LayoutDashboard,
          roles: ["OWNER", "MANAGER", "CASHIER", "STOCKKEEPER", "SALESPERSON"],
        },
        {
          name: "Point of Sale",
          href: "/sales",
          icon: ShoppingBag,
          roles: ["OWNER", "MANAGER", "CASHIER", "SALESPERSON"],
          badge: "POS",
        },
        {
          name: "Inventory Ledger",
          href: "/inventory",
          icon: Package,
          roles: ["OWNER", "MANAGER", "STOCKKEEPER", "SALESPERSON"],
        },
        {
          name: "Stock Transfers",
          href: "/transfers",
          icon: ArrowLeftRight,
          roles: ["OWNER", "MANAGER", "STOCKKEEPER", "SALESPERSON"],
        },
        {
          name: "Customer Accounts",
          href: "/customers",
          icon: Users,
          roles: ["OWNER", "MANAGER", "CASHIER", "SALESPERSON"],
        },
      ],
    },
    {
      title: "Control & Governance",
      items: [
        {
          name: "Attendance Roster",
          href: "/attendance",
          icon: Clock,
          roles: ["OWNER", "MANAGER", "CASHIER", "STOCKKEEPER", "SALESPERSON"],
        },
        {
          name: "Reconciliation",
          href: "/reconciliation",
          icon: Banknote,
          roles: ["OWNER", "MANAGER"],
        },
        {
          name: "Activity Audit",
          href: "/activity",
          icon: ShieldAlert,
          roles: ["OWNER", "MANAGER", "STOCKKEEPER", "SALESPERSON"],
        },
      ],
    },
    {
      title: "Platform Setup",
      items: [
        {
          name: "Settings & Catalog",
          href: "/settings",
          icon: Settings,
          roles: ["OWNER"],
        },
      ],
    },
  ]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  // Flat list for mobile drawer and shortcuts
  const allNavItems = navSections.flatMap((s) => s.items);

  const handleSwitchBranch = async (branchId: string) => {
    if (branchId === user.activeBranchId) {
      setBranchMenuOpen(false);
      return;
    }
    setIsSwitchingBranch(true);
    try {
      await fetch("/api/auth/switch-branch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId }),
      });
      setBranchMenuOpen(false);
      router.refresh();
    } finally {
      setIsSwitchingBranch(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Reset navigating indicator when pathname settles
  useEffect(() => {
    setNavigatingHref(null);
  }, [pathname]);

  // Pre-warm all accessible console routes in the background
  useEffect(() => {
    const timer = setTimeout(() => {
      allNavItems.forEach((item) => {
        try {
          router.prefetch(item.href);
        } catch {
          // ignore prefetch errors
        }
      });
      try {
        router.prefetch("/sales/new");
      } catch {
        // ignore prefetch errors
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [allNavItems, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Top Global Screen Progress Indicator when switching tabs */}
      {navigatingHref && (
        <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-slate-900/60 pointer-events-none overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-sky-400 via-teal-300 to-indigo-500 animate-progress-indeterminate shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/[0.08] bg-slate-950/85 backdrop-blur-2xl shrink-0 z-30 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-white/[0.08] bg-slate-900/30 backdrop-blur-md relative">
          <BrandLogo size="md" subtitle="Operations Platform" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        </div>

        {/* Categorized Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                <span>{section.title}</span>
              </div>

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    (item.href !== "/today" && pathname.startsWith(item.href));
                  const isPending = navigatingHref === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={true}
                      onMouseEnter={() => {
                        try {
                          router.prefetch(item.href);
                        } catch {}
                      }}
                      onClick={() => {
                        if (item.href !== pathname) {
                          setNavigatingHref(item.href);
                        }
                      }}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 group ${
                        active
                          ? "bg-gradient-to-r from-sky-500/15 via-brand/10 to-transparent border border-sky-400/25 text-white font-semibold shadow-xs"
                          : isPending
                          ? "bg-sky-500/10 border border-sky-400/30 text-sky-200"
                          : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]"
                      }`}
                    >
                      {/* Active Left Indicator Beacon */}
                      {active && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-sky-400 to-teal-400 rounded-r-full shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                      )}

                      {isPending ? (
                        <Loader2 className="w-4 h-4 shrink-0 text-sky-400 animate-spin" />
                      ) : (
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                            active
                              ? "text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                      )}

                      <span className="truncate">{item.name}</span>

                      {/* Optional Badge */}
                      {item.badge && (
                        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 tracking-wide">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile Card */}
        <div className="p-3 border-t border-white/[0.08] bg-slate-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-white/[0.06] hover:border-white/15 transition-all">
            {/* Avatar with Status Pulse */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/30 via-sky-500/25 to-teal-500/30 border border-sky-400/30 flex items-center justify-center text-xs font-black text-sky-300 shadow-xs">
                {user.employeeName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>

            {/* Profile Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-text-primary truncate leading-tight">
                {user.employeeName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-sm bg-sky-500/15 text-sky-300 border border-sky-500/20">
                  {user.role}
                </span>
                <span className="text-[10px] text-text-muted truncate">
                  {user.employeeNumber}
                </span>
              </div>
            </div>

            {/* Direct Logout Button */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area: Scroll Container */}
      <div className="flex-1 overflow-y-auto flex flex-col min-w-0 relative bg-background">
        {/* Subtle Top Ambient Glow Mesh that radiates through the transparent header */}
        <div className="absolute top-0 left-1/4 right-1/4 h-36 bg-gradient-to-b from-sky-500/[0.08] via-brand/[0.03] to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Top Navbar with Transparent Frosted Glassmorphism */}
        <header className="sticky top-0 z-40 h-16 border-b border-white/[0.08] bg-slate-950/25 backdrop-blur-2xl px-4 md:px-6 flex items-center justify-between gap-4 shrink-0 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.25)] transition-all">
          {/* Subtle Top Specular Sheen */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="flex items-center gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-subtle text-text-secondary hover:text-text-primary hover:bg-white/[0.05]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Branch Context Selector */}
            <div className="relative">
              {user.allowedBranches.length > 1 ? (
                <div>
                  <button
                    onClick={() => setBranchMenuOpen(!branchMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/40 backdrop-blur-md text-xs font-medium text-text-primary hover:bg-slate-800/60 hover:border-white/20 transition-all shadow-xs"
                  >
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    <span>{user.activeBranchName}</span>
                    <span className="text-[10px] text-text-muted">
                      ({user.activeBranchCode})
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted ml-0.5" />
                  </button>

                  {branchMenuOpen && (
                    <div className="absolute left-0 mt-2 w-60 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-2xl z-50 py-1.5 animate-scaleUp overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent pointer-events-none" />
                      <div className="px-3.5 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-wider border-b border-white/[0.08]">
                        Switch Active Branch
                      </div>
                      {user.allowedBranches.map((b) => (
                        <button
                          key={b.id}
                          disabled={isSwitchingBranch}
                          onClick={() => handleSwitchBranch(b.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left hover:bg-white/[0.06] transition-colors ${
                            b.id === user.activeBranchId
                              ? "text-sky-400 font-bold bg-sky-500/15"
                              : "text-text-primary"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-text-muted" />
                            <span>{b.name}</span>
                          </div>
                          {b.id === user.activeBranchId && (
                            <Check className="w-3.5 h-3.5 text-sky-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900/30 backdrop-blur-md text-xs font-medium text-text-secondary">
                  <Building2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>{user.activeBranchName}</span>
                  <span className="text-[10px] text-text-muted">
                    ({user.activeBranchCode})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Quick POS Action for authorized roles */}
            {["OWNER", "MANAGER", "CASHIER", "SALESPERSON"].includes(user.role) && (
              <Link
                href="/sales/new"
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-colors shadow-sm"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                + New Sale
              </Link>
            )}

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg border border-transparent hover:border-white/10 hover:bg-white/[0.04] transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-sky-400/30 flex items-center justify-center text-[11px] font-bold text-sky-300">
                  {user.employeeName[0]}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-text-primary">
                  {user.employeeName.split(" ")[0]}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur-2xl shadow-2xl z-50 py-1.5 overflow-hidden animate-scaleUp">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                  <div className="px-3.5 py-2.5 border-b border-white/[0.08]">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {user.employeeName}
                    </p>
                    <p className="text-[11px] text-text-muted truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-status-danger hover:bg-status-danger/10 transition-colors text-left font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-b border-white/[0.08] bg-slate-950/95 backdrop-blur-2xl px-4 py-3 space-y-1 shadow-2xl">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/today" && pathname.startsWith(item.href));
              const isPending = navigatingHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onMouseEnter={() => {
                    try {
                      router.prefetch(item.href);
                    } catch {}
                  }}
                  onClick={() => {
                    setMobileOpen(false);
                    if (item.href !== pathname) {
                      setNavigatingHref(item.href);
                    }
                  }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-gradient-to-r from-sky-500/20 via-brand/10 to-transparent border border-sky-400/30 text-white shadow-xs"
                      : isPending
                      ? "bg-sky-500/10 border border-sky-400/30 text-sky-200"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 shrink-0 text-sky-400 animate-spin" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 ${
                        active ? "text-sky-400" : "text-slate-400"
                      }`}
                    />
                  )}
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Page Body Viewport */}
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
