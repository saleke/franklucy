"use client";

import React, { useState, useMemo } from "react";
import {
  Building2,
  Package,
  Ruler,
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  ShieldAlert,
  Clock,
  DollarSign,
  Layers,
  MapPin,
  Phone,
  Tag,
  Boxes,
  HelpCircle,
  Users,
  ShieldCheck,
  Store,
  Sliders,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Link2,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  BranchItem,
  ProductItem,
  UnitItem,
  EmployeeItem,
} from "./types";
import { UnitsTab } from "./units-tab";
import { AttendanceTab } from "./attendance-tab";
import { EmployeeTab } from "./employee-tab";

export type { BranchItem, ProductItem, UnitItem, EmployeeItem };

interface SettingsWorkspaceProps {
  initialBranches: BranchItem[];
  initialProducts: ProductItem[];
  initialUnits: UnitItem[];
  initialEmployees: EmployeeItem[];
  isOwner: boolean;
}

export const AVAILABLE_UNITS = [
  { id: "CRATE", label: "Crate", desc: "Wholesale beverage crates (e.g. 24 or 12 slots)" },
  { id: "CARTON", label: "Carton", desc: "Standard cardboard shipping outer cartons" },
  { id: "PACK", label: "Pack", desc: "Shrink-wrapped wholesale or retail packs" },
  { id: "PIECE", label: "Piece", desc: "Individual discrete retail merchandise items" },
  { id: "BOTTLE", label: "Bottle", desc: "Individual glass or PET liquid bottles" },
  { id: "CAN", label: "Can", desc: "Standard aluminum beverage cans" },
  { id: "ROLL", label: "Roll", desc: "Continuous rolled packaging or merchandise" },
  { id: "BAG", label: "Bag / Sack", desc: "Bulk sacks, grains, or dry goods bags" },
  { id: "KEG", label: "Keg", desc: "Draft or bulk pressure liquid containers" },
  { id: "DOZEN", label: "Dozen", desc: "12-unit bundled packages" },
  { id: "OTHER", label: "Other Unit", desc: "Custom or non-standard packaging measurement" },
];

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  initialBranches,
  initialProducts,
  initialUnits,
  initialEmployees,
  isOwner,
}) => {
  const [activeTab, setActiveTab] = useState<
    "BRANCHES" | "PRODUCTS" | "UNITS" | "ATTENDANCE" | "EMPLOYEES" | "PROFILE"
  >("BRANCHES");

  // Units state
  const [units, setUnits] = useState<UnitItem[]>(initialUnits);
  const [addUnitOpen, setAddUnitOpen] = useState(false);

  // Employees state
  const [employees, setEmployees] = useState<EmployeeItem[]>(initialEmployees);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // Branches state
  const [branches, setBranches] = useState<BranchItem[]>(initialBranches);
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [editBranchItem, setEditBranchItem] = useState<BranchItem | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [branchStatus, setBranchStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [branchOpeningTime, setBranchOpeningTime] = useState("08:00");
  const [branchClosingTime, setBranchClosingTime] = useState("17:00");
  const [branchGracePeriod, setBranchGracePeriod] = useState(15);
  const [branchFormError, setBranchFormError] = useState<string | null>(null);
  const [isSubmittingBranch, setIsSubmittingBranch] = useState(false);

  // Products state
  const [products, setProducts] = useState<ProductItem[]>(initialProducts);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("ALL");
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editProductItem, setEditProductItem] = useState<ProductItem | null>(null);
  const [deleteProductCandidate, setDeleteProductCandidate] = useState<ProductItem | null>(null);

  const [prodSku, setProdSku] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("");
  const [prodUnit, setProdUnit] = useState("CRATE");
  const [prodBulkUnit, setProdBulkUnit] = useState("CRATE");
  const [prodPieceUnit, setProdPieceUnit] = useState("PIECE");
  const [prodPiecesPerBulk, setProdPiecesPerBulk] = useState("1");
  const [prodPrice, setProdPrice] = useState("");
  const [prodDefaultPiecePrice, setProdDefaultPiecePrice] = useState("");
  const [prodReorder, setProdReorder] = useState("10");
  const [prodStatus, setProdStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [prodBranchPrices, setProdBranchPrices] = useState<Record<string, string>>({});
  const [prodBranchPiecePrices, setProdBranchPiecePrices] = useState<Record<string, string>>({});
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  const bulkUnits = useMemo(() => {
    const list = units.filter((u) => u.scaleType === "BULK" || u.scaleType === "UNIVERSAL");
    return list.length > 0 ? list : units;
  }, [units]);

  const pieceUnits = useMemo(() => {
    const list = units.filter((u) => u.scaleType === "PIECE" || u.scaleType === "UNIVERSAL");
    return list.length > 0 ? list : units;
  }, [units]);

  const matchedBulkUnit = useMemo(() => {
    return units.find((u) => u.code.toUpperCase() === prodBulkUnit.toUpperCase());
  }, [units, prodBulkUnit]);

  const handleBulkUnitSelect = (code: string) => {
    setProdBulkUnit(code);
    const matched = units.find((u) => u.code.toUpperCase() === code.toUpperCase());
    if (matched) {
      if (matched.defaultPieceUnit) {
        setProdPieceUnit(matched.defaultPieceUnit);
      }
      if (matched.defaultRatio) {
        setProdPiecesPerBulk(matched.defaultRatio.toString());
      }
    }
  };

  // Toast / notification banner
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  // Branch Handlers
  const handleOpenAddBranch = () => {
    setBranchName("");
    setBranchCode("");
    setBranchAddress("");
    setBranchPhone("");
    setBranchStatus("ACTIVE");
    setBranchOpeningTime("08:00");
    setBranchClosingTime("17:00");
    setBranchGracePeriod(15);
    setBranchFormError(null);
    setAddBranchOpen(true);
  };

  const handleOpenEditBranch = (b: BranchItem) => {
    setEditBranchItem(b);
    setBranchName(b.name);
    setBranchCode(b.code);
    setBranchAddress(b.address || "");
    setBranchPhone(b.phone || "");
    setBranchStatus(b.status);
    setBranchOpeningTime(b.openingTime || "08:00");
    setBranchClosingTime(b.closingTime || "17:00");
    setBranchGracePeriod(b.gracePeriodMinutes ?? 15);
    setBranchFormError(null);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchFormError(null);
    setIsSubmittingBranch(true);

    try {
      if (editBranchItem) {
        // Edit
        const res = await fetch(`/api/settings/branches/${editBranchItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: branchName,
            address: branchAddress,
            phone: branchPhone,
            status: branchStatus,
            openingTime: branchOpeningTime,
            closingTime: branchClosingTime,
            gracePeriodMinutes: branchGracePeriod,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update branch.");

        setBranches((prev) =>
          prev.map((b) => (b.id === editBranchItem.id ? { ...b, ...data.branch } : b))
        );
        setEditBranchItem(null);
        showToast("success", `Branch '${branchName}' updated successfully.`);
      } else {
        // Create
        const res = await fetch("/api/settings/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: branchName,
            code: branchCode,
            address: branchAddress,
            phone: branchPhone,
            openingTime: branchOpeningTime,
            closingTime: branchClosingTime,
            gracePeriodMinutes: branchGracePeriod,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create branch.");

        // Refresh branch list
        const branchRes = await fetch("/api/settings/branches");
        if (branchRes.ok) {
          const bData = await branchRes.json();
          setBranches(bData.branches);
        }
        setAddBranchOpen(false);
        showToast("success", `New branch '${branchName}' (${branchCode}) established.`);
      }
    } catch (err: any) {
      setBranchFormError(err.message || "Failed to save branch.");
    } finally {
      setIsSubmittingBranch(false);
    }
  };

  // Product Handlers
  const handleOpenAddProduct = () => {
    setProdSku("");
    setProdName("");
    setProdCategory("");
    setProdUnit("CRATE");
    setProdBulkUnit("CRATE");
    const defaultBulk = units.find((u) => u.code.toUpperCase() === "CRATE");
    setProdPieceUnit(defaultBulk?.defaultPieceUnit || "BOTTLE");
    setProdPiecesPerBulk(defaultBulk?.defaultRatio ? defaultBulk.defaultRatio.toString() : "24");
    setProdPrice("");
    setProdDefaultPiecePrice("");
    setProdReorder("10");
    setProdStatus("ACTIVE");
    setProductFormError(null);
    setAddProductOpen(true);
  };

  const handleOpenEditProduct = (p: ProductItem) => {
    setEditProductItem(p);
    setProdSku(p.sku);
    setProdName(p.name);
    setProdCategory(p.category || "");
    setProdUnit(p.inventoryUnit);
    setProdBulkUnit(p.bulkUnit || p.inventoryUnit || "CRATE");
    setProdPieceUnit(p.pieceUnit || "PIECE");
    setProdPiecesPerBulk(String(p.piecesPerBulk || 1));
    setProdStatus(p.status);

    const bpMap: Record<string, string> = {};
    const bpPieceMap: Record<string, string> = {};
    p.branchProducts.forEach((bp) => {
      bpMap[bp.branchId] = bp.sellingPrice;
      bpPieceMap[bp.branchId] = bp.piecePrice || "";
    });
    setProdBranchPrices(bpMap);
    setProdBranchPiecePrices(bpPieceMap);
    setProductFormError(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);
    setIsSubmittingProduct(true);

    try {
      if (editProductItem) {
        // Edit product
        const res = await fetch(`/api/settings/products/${editProductItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: prodName,
            category: prodCategory,
            inventoryUnit: prodBulkUnit,
            bulkUnit: prodBulkUnit,
            pieceUnit: prodPieceUnit,
            piecesPerBulk: Number(prodPiecesPerBulk) || 1,
            status: prodStatus,
            branchPrices: prodBranchPrices,
            branchPiecePrices: prodBranchPiecePrices,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update product.");

        // Refresh product list
        const prodRes = await fetch("/api/settings/products");
        if (prodRes.ok) {
          const pData = await prodRes.json();
          setProducts(pData.products);
        }
        setEditProductItem(null);
        showToast("success", `Product '${prodName}' updated successfully.`);
      } else {
        // Create product
        const res = await fetch("/api/settings/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: prodSku,
            name: prodName,
            category: prodCategory,
            inventoryUnit: prodBulkUnit,
            bulkUnit: prodBulkUnit,
            pieceUnit: prodPieceUnit,
            piecesPerBulk: Number(prodPiecesPerBulk) || 1,
            defaultPrice: prodPrice,
            defaultPiecePrice: prodDefaultPiecePrice || null,
            defaultReorderLevel: prodReorder,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to add product.");

        // Refresh product list
        const prodRes = await fetch("/api/settings/products");
        if (prodRes.ok) {
          const pData = await prodRes.json();
          setProducts(pData.products);
        }
        setAddProductOpen(false);
        showToast("success", `New product '${prodName}' (${prodSku}) added to catalog.`);
      }
    } catch (err: any) {
      setProductFormError(err.message || "Failed to save product.");
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (p: ProductItem) => {
    try {
      const res = await fetch(`/api/settings/products/${p.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product.");

      setProducts((prev) => prev.filter((item) => item.id !== p.id));
      setDeleteProductCandidate(null);
      showToast("success", `Product '${p.name}' deleted.`);
    } catch (err: any) {
      showToast("error", err.message || "Cannot delete product.");
      setDeleteProductCandidate(null);
    }
  };

  // Filtered Products
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
  const filteredProducts = products.filter((p) => {
    if (productCategoryFilter !== "ALL" && p.category !== productCategoryFilter) return false;
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku.toLowerCase().includes(q);
      if (!matchName && !matchSku) return false;
    }
    return true;
  });

  // Domain Definitions with Color Themes
  const DOMAIN_SECTIONS = [
    {
      id: "BRANCHES" as const,
      label: "Store Locations",
      sublabel: "Physical Network",
      icon: Building2,
      badge: `${branches.length} Stores`,
      color: "emerald",
      iconStyle: "bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25",
      activeStyle: "bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-surface border-emerald-500/60 shadow-emerald-500/5",
      activeText: "text-emerald-300",
      badgeStyle: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      desc: "Manage physical store locations, registers, and addresses",
    },
    {
      id: "EMPLOYEES" as const,
      label: "Workforce & Org",
      sublabel: "Team Governance",
      icon: Users,
      badge: `${employees.length} Staff`,
      color: "violet",
      iconStyle: "bg-violet-500/15 text-violet-400 group-hover:bg-violet-500/25",
      activeStyle: "bg-gradient-to-br from-violet-500/15 via-violet-500/5 to-surface border-violet-500/60 shadow-violet-500/5",
      activeText: "text-violet-300",
      badgeStyle: "bg-violet-500/20 text-violet-300 border-violet-500/30",
      desc: "Staff profiles, role privileges (Sales, Manager, Cashier), and transfers",
    },
    {
      id: "PRODUCTS" as const,
      label: "Catalog & Pricing",
      sublabel: "Merchandise Master",
      icon: Package,
      badge: `${products.length} Products`,
      color: "amber",
      iconStyle: "bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25",
      activeStyle: "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-surface border-amber-500/60 shadow-amber-500/5",
      activeText: "text-amber-300",
      badgeStyle: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      desc: "Master products, reorder thresholds, and multi-branch selling prices",
    },
    {
      id: "UNITS" as const,
      label: "Packaging Scales",
      sublabel: "Unit Standards",
      icon: Ruler,
      badge: `${units.length} Units`,
      color: "cyan",
      iconStyle: "bg-cyan-500/15 text-cyan-400 group-hover:bg-cyan-500/25",
      activeStyle: "bg-gradient-to-br from-cyan-500/15 via-cyan-500/5 to-surface border-cyan-500/60 shadow-cyan-500/5",
      activeText: "text-cyan-300",
      badgeStyle: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
      desc: "Crates, cartons, packs, bundles, pieces, and wholesale packaging",
    },
    {
      id: "ATTENDANCE" as const,
      label: "Shift Schedules",
      sublabel: "Operating Hours",
      icon: Clock,
      badge: `${branches.length} Schedules`,
      color: "orange",
      iconStyle: "bg-orange-500/15 text-orange-400 group-hover:bg-orange-500/25",
      activeStyle: "bg-gradient-to-br from-orange-500/15 via-orange-500/5 to-surface border-orange-500/60 shadow-orange-500/5",
      activeText: "text-orange-300",
      badgeStyle: "bg-orange-500/20 text-orange-300 border-orange-500/30",
      desc: "Daily opening, evening closing, lateness grace buffer, and owner exemption",
    },
    {
      id: "PROFILE" as const,
      label: "Enterprise Profile",
      sublabel: "Identity & Rules",
      icon: Settings,
      badge: "₦ NGN",
      color: "blue",
      iconStyle: "bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25",
      activeStyle: "bg-gradient-to-br from-blue-500/15 via-blue-500/5 to-surface border-blue-500/60 shadow-blue-500/5",
      activeText: "text-blue-300",
      badgeStyle: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      desc: "Legal entity, currency (NGN), fiscal timezone, and security guardrails",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div
          className={`p-3.5 rounded-card border flex items-center justify-between text-xs animate-slideDown shadow-lg ${
            toastMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-status-danger-subtle border-status-danger/30 text-status-danger"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-status-danger" />
            )}
            <span className="font-medium">{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="opacity-70 hover:opacity-100 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP EXECUTIVE HERO BANNER WITH AMBIENT GLOW & NETWORK VITALS */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden p-6 rounded-card border border-border/80 bg-gradient-to-r from-surface via-surface-elevated/30 to-surface shadow-md">
        {/* Soft background ambient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-1/4 w-60 h-60 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-text-primary">
                Frank<span className="text-brand font-black">Lucy</span>
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Executive Operations Control Center
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Business Configuration & Operations
            </h1>
            <p className="text-xs text-text-secondary max-w-2xl leading-relaxed">
              Command interface for physical store provisioning, multi-branch merchandise pricing, staff role governance, and server-authoritative operating schedules.
            </p>
          </div>

          {/* Primary Action Button depending on active domain */}
          {activeTab === "BRANCHES" && (
            <Button
              size="sm"
              onClick={handleOpenAddBranch}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold gap-1.5 shadow-md shrink-0 h-9 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Store Branch</span>
            </Button>
          )}
          {activeTab === "PRODUCTS" && (
            <Button
              size="sm"
              onClick={handleOpenAddProduct}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold gap-1.5 shadow-md shrink-0 h-9 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </Button>
          )}
          {activeTab === "UNITS" && (
            <Button
              size="sm"
              onClick={() => setAddUnitOpen(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-xs font-bold gap-1.5 shadow-md shrink-0 h-9 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Add Packaging Unit</span>
            </Button>
          )}
          {activeTab === "EMPLOYEES" && (
            <Button
              size="sm"
              onClick={() => setAddEmployeeOpen(true)}
              className="bg-violet-500 hover:bg-violet-600 text-white text-xs font-bold gap-1.5 shadow-md shrink-0 h-9 px-4"
            >
              <Plus className="w-4 h-4" />
              <span>Add Team Member</span>
            </Button>
          )}
        </div>

        {/* Live Network Vitals Strip */}
        <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-card bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-text-primary leading-none">
                {branches.length} <span className="text-xs font-normal text-text-muted">Outlets</span>
              </div>
              <div className="text-[10px] text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {branches.filter((b) => b.status === "ACTIVE").length} Open for Trade
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-card bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-text-primary leading-none">
                {employees.length} <span className="text-xs font-normal text-text-muted">Staff</span>
              </div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">
                Active Workforce
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-card bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-text-primary leading-none">
                {products.length} <span className="text-xs font-normal text-text-muted">Products</span>
              </div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">
                {categories.length} Categories Priced
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-card bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-black text-text-primary leading-none">
                {branches.reduce((acc, b) => acc + b.activeCashDrawersCount, 0)}{" "}
                <span className="text-xs font-normal text-text-muted">Drawers</span>
              </div>
              <div className="text-[10px] text-text-muted font-medium mt-0.5">
                Open Cash Sessions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXECUTIVE DOMAIN CONTROL HUB (Rich Color-Themed Selector) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {DOMAIN_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`p-3.5 rounded-card border text-left transition-all duration-200 flex flex-col justify-between group relative overflow-hidden ${
                isActive
                  ? `${section.activeStyle} shadow-md`
                  : "bg-surface border-border hover:border-border/90 hover:bg-surface-elevated/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2.5">
                  <div
                    className={`w-8 h-8 rounded-subtle flex items-center justify-center transition-colors shrink-0 ${
                      isActive
                        ? "bg-white/10 text-white"
                        : section.iconStyle
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? section.badgeStyle
                        : "bg-surface-elevated text-text-muted border-border"
                    }`}
                  >
                    {section.badge}
                  </span>
                </div>
                <div
                  className={`text-xs font-black tracking-tight leading-snug ${
                    isActive ? section.activeText : "text-text-primary"
                  }`}
                >
                  {section.label}
                </div>
              </div>
              <div className="text-[10px] text-text-muted line-clamp-1 mt-1 font-medium">
                {section.sublabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* DOMAIN 1: STORE LOCATIONS & NETWORK */}
      {/* ========================================================================= */}
      {activeTab === "BRANCHES" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                <span>Store Locations</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {branches.length} Active Outlets
                </span>
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Manage commercial selling points, physical addresses, shift policies, and cash register sessions.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <Card
                key={b.id}
                className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/[0.08] via-surface to-surface border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 flex flex-col justify-between shadow-xs space-y-4 rounded-card"
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-3.5 relative">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex flex-col items-center justify-center shadow-xs shrink-0 group-hover:border-emerald-500/50 transition-colors">
                        <Building2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-[9px] font-mono font-black text-emerald-300 tracking-wider mt-0.5">{b.code}</span>
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-text-primary leading-tight">
                          {b.name}
                        </h4>
                        <div className="text-[10px] font-mono text-text-muted mt-0.5">
                          ID: {b.id.slice(0, 14)}...
                        </div>
                      </div>
                    </div>

                    <div>
                      {b.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-surface-elevated text-text-muted border border-border">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Physical & Contact Details */}
                  <div className="space-y-1.5 text-xs text-text-secondary">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{b.address || "No physical address configured"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-muted text-[11px]">
                      <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span>{b.phone || "No phone contact on file"}</span>
                    </div>
                  </div>

                  {/* Operational Gauges Mini-Grid */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded-subtle bg-surface-elevated/40 border border-border">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">
                        Team
                      </span>
                      <span className="font-mono text-xs font-bold text-text-primary mt-0.5 block">
                        {b.activeEmployeesCount} staff
                      </span>
                    </div>

                    <div className="p-2 rounded-subtle bg-surface-elevated/40 border border-border">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">
                        Products
                      </span>
                      <span className="font-mono text-xs font-bold text-text-primary mt-0.5 block">
                        {b.productsCount} items
                      </span>
                    </div>

                    <div className="p-2 rounded-subtle bg-surface-elevated/40 border border-border">
                      <span className="text-[10px] text-text-muted uppercase font-bold block">
                        Registers
                      </span>
                      <span
                        className={`font-mono text-xs font-bold mt-0.5 block ${
                          b.activeCashDrawersCount > 0 ? "text-emerald-400" : "text-text-muted"
                        }`}
                      >
                        {b.activeCashDrawersCount} active
                      </span>
                    </div>
                  </div>

                  {/* Shift & Operating Hours Pill */}
                  <div className="p-2.5 rounded-subtle bg-surface-elevated/30 border border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{b.openingTime || "08:00"} - {b.closingTime || "17:00"} WAT</span>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">
                      +{b.gracePeriodMinutes ?? 15}m grace
                    </span>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditBranch(b)}
                    className="flex-1 text-xs font-semibold gap-1.5 h-8 border-border hover:bg-surface-elevated text-text-primary"
                  >
                    <Edit2 className="w-3 h-3 text-emerald-400" />
                    <span>Edit Location</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("ATTENDANCE")}
                    className="text-xs text-text-secondary hover:text-emerald-400 h-8 px-2.5"
                    title="Configure shifts for this branch"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOMAIN 2: MERCHANDISE & CATALOG MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "PRODUCTS" && (
        <div className="space-y-4">
          {/* Catalog Controls & Search */}
          <Card className="p-3.5 bg-surface border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search products by SKU or name..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Category Filter & Metrics */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-xs text-text-muted">
                  Showing <strong className="text-text-primary">{filteredProducts.length}</strong> of {products.length} products
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="bg-surface-elevated border border-border rounded-subtle px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-amber-400 font-medium"
                  >
                    <option value="ALL">All Categories ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c} value={c as string}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          {/* Product Dossier Cards Grid (Warm Amber Themed) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredProducts.map((p) => (
              <Card
                key={p.id}
                className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.08] via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between shadow-xs space-y-4 rounded-card"
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-3.5 relative">
                  {/* Top Bar: Name, SKU, Status */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-xs">
                          {p.sku}
                        </span>
                        <h4 className="text-base font-bold text-text-primary">{p.name}</h4>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-[10px] font-medium text-text-secondary">
                          Category: {p.category || "General"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-mono font-semibold">
                          Bulk: {p.bulkUnit || p.inventoryUnit}
                        </span>
                        {(p.piecesPerBulk || 1) > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                            1 {p.bulkUnit || p.inventoryUnit} = {p.piecesPerBulk} {p.pieceUnit || "PIECE"}s
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      {p.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-surface-elevated text-text-muted border border-border">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-Branch Selling Price Matrix */}
                  <div className="p-3.5 rounded-card bg-surface-elevated/40 border border-border space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      <span className="text-amber-400 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Selling Price By Location
                      </span>
                      <span className="text-text-muted font-mono">Server Authoritative (₦ NGN)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      {p.branchProducts.map((bp) => (
                        <div
                          key={bp.id}
                          className="p-2 rounded-subtle bg-surface border border-border/80 flex flex-col justify-between"
                        >
                          <div className="text-[10px] font-mono text-text-muted font-bold">
                            {bp.branchName} ({bp.branchCode})
                          </div>
                          <div className="font-mono text-xs font-bold text-emerald-400 mt-1">
                            {formatNaira(bp.sellingPrice)}
                            <span className="text-[9px] text-text-muted font-normal ml-0.5">/ {p.bulkUnit || p.inventoryUnit}</span>
                          </div>
                          {bp.piecePrice && (
                            <div className="font-mono text-[11px] font-semibold text-emerald-300 mt-0.5">
                              {formatNaira(bp.piecePrice)}
                              <span className="text-[9px] text-text-muted font-normal ml-0.5">/ {p.pieceUnit || "PIECE"}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Operational Records & Thresholds */}
                  <div className="flex items-center justify-between text-xs text-text-muted pt-1">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Boxes className="w-3.5 h-3.5 text-text-muted" />
                      <span>Historical: {p.saleItemsCount} sales · {p.inventoryMovementsCount} movements</span>
                    </div>

                    <div className="text-[11px] font-mono text-amber-400 font-medium">
                      Reorder Alert: ≤10 units
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditProduct(p)}
                    className="flex-1 text-xs font-semibold gap-1.5 h-8 border-border hover:bg-surface-elevated text-text-primary"
                  >
                    <Edit2 className="w-3 h-3 text-amber-400" />
                    <span>Edit Details & Branch Pricing</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteProductCandidate(p)}
                    className="h-8 px-2.5 text-xs text-status-danger hover:bg-status-danger-subtle/50"
                    title="Delete product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DOMAIN 3: UNITS OF MEASUREMENT */}
      {/* ========================================================================= */}
      {activeTab === "UNITS" && (
        <UnitsTab
          units={units}
          setUnits={setUnits}
          showToast={showToast}
          openAddModal={addUnitOpen}
          setOpenAddModal={setAddUnitOpen}
        />
      )}

      {/* ========================================================================= */}
      {/* DOMAIN 4: ATTENDANCE & SHIFT SCHEDULES */}
      {/* ========================================================================= */}
      {activeTab === "ATTENDANCE" && (
        <AttendanceTab
          branches={branches}
          setBranches={setBranches}
          showToast={showToast}
        />
      )}

      {/* ========================================================================= */}
      {/* DOMAIN 5: STAFF & EMPLOYEE MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "EMPLOYEES" && (
        <EmployeeTab
          employees={employees}
          setEmployees={setEmployees}
          branches={branches}
          showToast={showToast}
          openAddModal={addEmployeeOpen}
          setOpenAddModal={setAddEmployeeOpen}
        />
      )}

      {/* ========================================================================= */}
      {/* DOMAIN 6: BUSINESS PROFILE & GUARDRAILS */}
      {/* ========================================================================= */}
      {activeTab === "PROFILE" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* General Information Card */}
          <Card className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/[0.08] via-surface to-surface border border-blue-500/20 space-y-4 shadow-sm rounded-card">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 pb-3 border-b border-border relative">
              <Building2 className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-text-primary">Enterprise Commercial Identity</h3>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold">Registered Legal Entity</label>
                <div className="font-bold text-text-primary text-base mt-1 flex items-center gap-2">
                  <span>
                    Frank<span className="text-brand">Lucy</span> Trading & Distribution Ltd
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-xs bg-brand-subtle text-brand border border-brand/20 font-semibold">
                    RC: 1849202
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-text-muted uppercase font-bold">Primary Commercial Headquarters</label>
                <div className="text-text-secondary mt-0.5">Lagos Central Commercial District, Lagos State, Nigeria</div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold">Operating Currency</label>
                  <div className="font-semibold text-text-primary text-sm mt-0.5">Nigerian Naira (₦ NGN)</div>
                </div>

                <div>
                  <label className="text-[10px] text-text-muted uppercase font-bold">Fiscal Timezone</label>
                  <div className="font-semibold text-text-primary text-sm mt-0.5">Africa/Lagos (UTC+1)</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Operational Guardrails Card */}
          <Card className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/[0.08] via-surface to-surface border border-emerald-500/20 space-y-4 shadow-sm rounded-card">
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center gap-2 pb-3 border-b border-border relative">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-text-primary">Server-Authoritative Operational Guardrails</h3>
            </div>

            <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
              <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border">
                <span className="font-semibold text-text-primary block text-xs">
                  Zero-Noise Branch Switching
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Eligible enterprise accounts (Owner & Managers) observe and switch between physical branches freely without generating audit trail noise.
                </p>
              </div>

              <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border">
                <span className="font-semibold text-text-primary block text-xs">
                  Frontline Salesperson Dual Authority
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Sales staff in single-staff outlets possess dual authority to conduct POS sales and directly receive incoming stock shipments without requiring separate cashier/storekeeper personnel.
                </p>
              </div>

              <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border">
                <span className="font-semibold text-text-primary block text-xs">
                  Strict Cash Drawer Float Mandate
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Cashiers cannot complete cash transactions without an explicitly declared opening cash drawer session.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT BRANCH */}
      {/* ========================================================================= */}
      {(addBranchOpen || editBranchItem) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-16 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent pointer-events-none" />

            <form onSubmit={handleSaveBranch} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0 relative bg-surface/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      {editBranchItem ? `Edit Branch: ${editBranchItem.name}` : "Create New Branch"}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Physical store & point of sale outlet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddBranchOpen(false);
                    setEditBranchItem(null);
                  }}
                  className="w-7 h-7 rounded-lg bg-surface-elevated/60 text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1 overscroll-contain">
                {branchFormError && (
                  <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{branchFormError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lekki Phase 1 Branch"
                    value={branchName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setBranchName(newName);
                      if (!editBranchItem) {
                        const clean = newName.trim().replace(/[^a-zA-Z0-9\s]/g, "");
                        const words = clean.split(/\s+/).filter(Boolean);
                        let autoCode = "";
                        if (words.length >= 3) {
                          autoCode = (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
                        } else if (words.length === 2) {
                          autoCode = (words[0].slice(0, 2) + words[1].slice(0, 2)).toUpperCase().slice(0, 4);
                        } else if (words.length === 1) {
                          autoCode = words[0].slice(0, 3).toUpperCase();
                        }
                        setBranchCode(autoCode);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Branch Abbreviation Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    disabled={!!editBranchItem}
                    placeholder="e.g. LEK"
                    value={branchCode}
                    onChange={(e) => setBranchCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-50 transition-all font-bold"
                  />
                  {editBranchItem ? (
                    <span className="text-[10px] text-text-muted mt-1 block">
                      Branch code cannot be altered after creation to preserve invoice numbering integrity.
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-muted mt-1 block">
                      Enforced 3-4 character uppercase identifier (auto-derived from branch name, e.g. LEK, VIC, IKE). Used for receipts and stock tags.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Admiralty Way, Lekki, Lagos"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Phone Contact
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 08033221100"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Shift Opening Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={branchOpeningTime}
                      onChange={(e) => setBranchOpeningTime(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <span className="text-[10px] text-text-muted mt-0.5 block">Standard start time</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Shift Closing Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={branchClosingTime}
                      onChange={(e) => setBranchClosingTime(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <span className="text-[10px] text-text-muted mt-0.5 block">Standard closing time</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Lateness Grace Period (Minutes) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={branchGracePeriod}
                    onChange={(e) => setBranchGracePeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400 font-mono"
                  />
                  <span className="text-[10px] text-text-muted mt-0.5 block">
                    Staff clocking in past this grace cutoff are recorded as Late.
                  </span>
                </div>

                {editBranchItem && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Operating Status
                    </label>
                    <select
                      value={branchStatus}
                      onChange={(e) => setBranchStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-emerald-400 font-medium"
                    >
                      <option value="ACTIVE">ACTIVE (Open for sales and stock)</option>
                      <option value="INACTIVE">INACTIVE (Temporarily closed)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-border/60 bg-surface-elevated/40 shrink-0 relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddBranchOpen(false);
                    setEditBranchItem(null);
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingBranch}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg px-4"
                >
                  {isSubmittingBranch ? "Saving..." : editBranchItem ? "Update Branch" : "Create Branch"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT PRODUCT */}
      {/* ========================================================================= */}
      {(addProductOpen || editProductItem) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-16 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

            <form onSubmit={handleSaveProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0 relative bg-surface/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      {editProductItem ? `Edit Product: ${editProductItem.name}` : "Add New Catalog Product"}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Commercial SKU, pricing & packaging scale</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddProductOpen(false);
                    setEditProductItem(null);
                  }}
                  className="w-7 h-7 rounded-lg bg-surface-elevated/60 text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {productFormError && (
                <div className="p-3 rounded-subtle bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs">
                  {productFormError}
                </div>
              )}

              <div className="space-y-3.5 text-xs overflow-y-auto pr-1 flex-1">
                {/* SKU & Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      SKU (Unique Code) *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editProductItem}
                      placeholder="e.g. GUIN-CRATE"
                      value={prodSku}
                      onChange={(e) => setProdSku(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Guinness Extra Stout"
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Category & Bulk Unit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Beer, Juice, Dairy, Soft Drinks"
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Bulk Packaging Scale *
                    </label>
                    <select
                      value={prodBulkUnit}
                      onChange={(e) => handleBulkUnitSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400 font-medium font-mono"
                    >
                      {bulkUnits.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.name} ({u.code})
                        </option>
                      ))}
                      {!bulkUnits.some((u) => u.code === prodBulkUnit) && prodBulkUnit ? (
                        <option value={prodBulkUnit}>
                          {prodBulkUnit} (Custom)
                        </option>
                      ) : null}
                    </select>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-text-muted">Quick select:</span>
                      {["CRATE", "CARTON", "PACK", "BAG", "KEG"].map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => handleBulkUnitSelect(code)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all ${
                            prodBulkUnit === code
                              ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                              : "bg-surface text-text-muted hover:text-text-primary border border-border"
                          }`}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Loose Piece & Packaging Conversion */}
                <div className="space-y-2">
                  {matchedBulkUnit && matchedBulkUnit.defaultPieceUnit && (
                    <div className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                      <div className="flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Inferred from <strong>{matchedBulkUnit.name}</strong> standard pairing:</span>
                      </div>
                      <span className="font-mono font-bold">1 {matchedBulkUnit.code} = {matchedBulkUnit.defaultRatio || prodPiecesPerBulk} {matchedBulkUnit.defaultPieceUnit}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-card bg-surface-elevated/30 border border-border">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                        Single Item / Loose Unit *
                      </label>
                      <select
                        value={prodPieceUnit}
                        onChange={(e) => setProdPieceUnit(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400 font-medium font-mono"
                      >
                        {pieceUnits.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.name} ({u.code})
                          </option>
                        ))}
                        {!pieceUnits.some((u) => u.code === prodPieceUnit) && prodPieceUnit ? (
                          <option value={prodPieceUnit}>
                            {prodPieceUnit} (Custom)
                          </option>
                        ) : null}
                      </select>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-text-muted">Quick select:</span>
                        {["BOTTLE", "CAN", "PIECE", "SACHET", "CUP"].map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setProdPieceUnit(code)}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all ${
                              prodPieceUnit === code
                                ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                                : "bg-surface text-text-muted hover:text-text-primary border border-border"
                            }`}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                        Pieces Per Bulk Unit *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="e.g. 24"
                        value={prodPiecesPerBulk}
                        onChange={(e) => setProdPiecesPerBulk(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <span className="text-[10px] text-text-muted mt-0.5 block font-mono">
                        1 {prodBulkUnit} = {prodPiecesPerBulk || 1} {prodPieceUnit}s
                      </span>
                    </div>
                  </div>
                </div>

                {/* Default Pricing or Branch Price Grid */}
                {!editProductItem ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                          Bulk Selling Price (NGN) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          required
                          placeholder="e.g. 42000"
                          value={prodPrice}
                          onChange={(e) => setProdPrice(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-[10px] text-text-muted mt-0.5 block">
                          Price per {prodBulkUnit}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                          Loose Piece Price (NGN, Optional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          placeholder={
                            prodPrice && Number(prodPiecesPerBulk) > 1
                              ? `e.g. ${Math.ceil(Number(prodPrice) / Number(prodPiecesPerBulk))}`
                              : "Optional loose price"
                          }
                          value={prodDefaultPiecePrice}
                          onChange={(e) => setProdDefaultPiecePrice(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400"
                        />
                        <span className="text-[10px] text-text-muted mt-0.5 block">
                          Price per {prodPieceUnit} (leave blank to auto-calculate)
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                        Reorder Alert Threshold (Base Pieces)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="e.g. 240"
                        value={prodReorder}
                        onChange={(e) => setProdReorder(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-text-muted mt-0.5 block">
                        Minimum inventory balance before low-stock alert triggers
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold uppercase text-text-secondary">
                      Branch Selling Prices (NGN)
                    </label>
                    <div className="space-y-3 max-h-52 overflow-y-auto border border-border rounded-subtle p-2.5 bg-surface-elevated/20">
                      {branches.map((b) => (
                        <div key={b.id} className="p-2.5 rounded-subtle bg-surface border border-border space-y-2">
                          <div className="font-semibold text-text-primary text-xs flex items-center justify-between">
                            <span>{b.name} ({b.code})</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-text-muted block mb-1">Bulk ({prodBulkUnit}):</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={prodBranchPrices[b.id] || ""}
                                onChange={(e) =>
                                  setProdBranchPrices((prev) => ({
                                    ...prev,
                                    [b.id]: e.target.value,
                                  }))
                                }
                                placeholder="Bulk Price"
                                className="w-full px-2.5 py-1 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-text-muted block mb-1">Loose ({prodPieceUnit}):</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={prodBranchPiecePrices[b.id] || ""}
                                onChange={(e) =>
                                  setProdBranchPiecePrices((prev) => ({
                                    ...prev,
                                    [b.id]: e.target.value,
                                  }))
                                }
                                placeholder="Piece Price"
                                className="w-full px-2.5 py-1 bg-surface-elevated border border-border rounded-subtle font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                        Operating Status
                      </label>
                      <select
                        value={prodStatus}
                        onChange={(e) => setProdStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400 font-medium"
                      >
                        <option value="ACTIVE">ACTIVE (Available for sales and receiving)</option>
                        <option value="INACTIVE">INACTIVE (Archived from catalog)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-border/60 bg-surface-elevated/40 shrink-0 relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddProductOpen(false);
                    setEditProductItem(null);
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingProduct}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-lg px-4"
                >
                  {isSubmittingProduct ? "Saving..." : editProductItem ? "Update Product" : "Add Product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE PRODUCT CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteProductCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-sm flex flex-col p-5 space-y-4 animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-16 bg-rose-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/40 to-transparent pointer-events-none" />

            <div className="flex items-center gap-2.5 text-status-danger relative">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Delete Product?</h3>
                <p className="text-[10px] text-text-muted">Permanent catalog deletion</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed relative">
              Are you sure you want to permanently delete <strong className="text-text-primary">{deleteProductCandidate.name}</strong> ({deleteProductCandidate.sku})?
            </p>

            <div className="p-3 bg-status-warning-subtle/20 border border-status-warning/30 rounded-lg text-[11px] text-status-warning leading-relaxed relative">
              Note: If this product has ever had recorded sales, inventory movements, or stock transfers, it cannot be hard-deleted to preserve historical audit records. Use <strong>Edit → Inactive</strong> instead.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60 relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteProductCandidate(null)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleDeleteProduct(deleteProductCandidate)}
                className="bg-status-danger hover:bg-status-danger/90 text-white text-xs font-semibold rounded-lg px-3.5"
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
