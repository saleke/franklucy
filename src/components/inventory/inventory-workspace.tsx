"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Plus,
  AlertTriangle,
  History,
  TrendingDown,
  Building2,
  X,
  Search,
  CheckCircle2,
  Boxes,
  Tag,
  Info,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { formatNaira, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface InventoryItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  category: string | null;
  inventoryUnit: string;
  bulkUnit: string;
  pieceUnit: string;
  piecesPerBulk: number;
  sellingPrice: number;
  piecePrice: number | null;
  currentStock: number;
  reorderLevel: number;
  movements: {
    id: string;
    type: string;
    quantity: number;
    reason: string | null;
    createdAt: string;
    employeeName: string;
  }[];
}

interface InventoryWorkspaceProps {
  branchName: string;
  branchCode: string;
  userRole: string;
  items: InventoryItem[];
  isOwner?: boolean;
  branches?: { id: string; name: string; code: string }[];
  selectedBranchId?: string;
}

export function formatStockDisplay(
  currentStockPieces: number,
  bulkUnit: string = "CRATE",
  pieceUnit: string = "PIECE",
  piecesPerBulk: number = 1
): string {
  if (piecesPerBulk <= 1) {
    return `${currentStockPieces} ${bulkUnit}${currentStockPieces === 1 ? "" : "s"}`;
  }
  const fullBulk = Math.floor(currentStockPieces / piecesPerBulk);
  const loose = currentStockPieces % piecesPerBulk;

  if (fullBulk > 0 && loose > 0) {
    return `${fullBulk} ${bulkUnit}${fullBulk === 1 ? "" : "s"} + ${loose} ${pieceUnit}${loose === 1 ? "" : "s"}`;
  }
  if (fullBulk > 0) {
    return `${fullBulk} ${bulkUnit}${fullBulk === 1 ? "" : "s"}`;
  }
  return `${loose} ${pieceUnit}${loose === 1 ? "" : "s"}`;
}

export const InventoryWorkspace: React.FC<InventoryWorkspaceProps> = ({
  branchName,
  branchCode,
  userRole,
  items,
  isOwner = false,
  branches = [],
  selectedBranchId,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(
    null
  );

  // Modals
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [damageModalOpen, setDamageModalOpen] = useState(false);

  // Receive Form
  const [receiveProductId, setReceiveProductId] = useState(
    items[0]?.productId || ""
  );
  const [receiveQuantity, setReceiveQuantity] = useState("20");
  const [receiveUnitType, setReceiveUnitType] = useState<"BULK" | "PIECE">("BULK");
  const [receiveSupplier, setReceiveSupplier] = useState("Nigerian Breweries PLC");
  const [receiveRef, setReceiveRef] = useState("DEL-2026-904");
  const [isReceiving, setIsReceiving] = useState(false);

  // Damage Form
  const [damageProductId, setDamageProductId] = useState(
    items[0]?.productId || ""
  );
  const [damageQuantity, setDamageQuantity] = useState("1");
  const [damageUnitType, setDamageUnitType] = useState<"BULK" | "PIECE">("BULK");
  const [damageReason, setDamageReason] = useState("Broken bottles during unloading");
  const [damageNotes, setDamageNotes] = useState("");
  const [isDamaging, setIsDamaging] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [stockFilter, setStockFilter] = useState<"ALL" | "HEALTHY" | "LOW" | "OUT">("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const pageSize = 15;

  const lowStockCount = items.filter((i) => i.currentStock > 0 && i.currentStock <= i.reorderLevel).length;
  const outOfStockCount = items.filter((i) => i.currentStock <= 0).length;
  const healthyCount = items.filter((i) => i.currentStock > i.reorderLevel).length;

  const categories = ["ALL", ...Array.from(new Set(items.map((i) => i.category || "Unassigned"))).sort()];

  const filteredItems = items.filter((item) => {
    if (stockFilter === "LOW" && !(item.currentStock > 0 && item.currentStock <= item.reorderLevel)) {
      return false;
    }
    if (stockFilter === "OUT" && item.currentStock > 0) {
      return false;
    }
    if (stockFilter === "HEALTHY" && item.currentStock <= item.reorderLevel) {
      return false;
    }
    if (selectedCategory !== "ALL" && (item.category || "Unassigned") !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleReceiveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReceiving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/inventory/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: receiveSupplier,
          reference: receiveRef,
          items: [{
            productId: receiveProductId,
            quantity: Number(receiveQuantity),
            unitType: receiveUnitType,
          }],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Failed to receive stock." });
      } else {
        setReceiveModalOpen(false);
        setFeedback({
          type: "success",
          message: "Stock shipment successfully added to branch inventory.",
        });
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Network error occurred." });
    } finally {
      setIsReceiving(false);
    }
  };

  const handleRecordDamage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDamaging(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/inventory/damage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: damageProductId,
          quantity: Number(damageQuantity),
          unitType: damageUnitType,
          reason: damageReason,
          notes: damageNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Failed to record damage." });
      } else {
        setDamageModalOpen(false);
        setFeedback({
          type: "success",
          message: "Damaged inventory logged and deducted from available stock.",
        });
        router.refresh();
      }
    } catch {
      setFeedback({ type: "error", message: "Network error occurred." });
    } finally {
      setIsDamaging(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-card bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <span>Branch Inventory & Stock Ledger</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time stock balance, warehouse replenishment, shrinkage logging & immutable movement ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["OWNER", "MANAGER", "STOCKKEEPER", "SALESPERSON"].includes(userRole) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDamageModalOpen(true)}
                className="gap-1.5 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 h-9 px-3.5 font-semibold"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Record Damaged / Expired
              </Button>
              <Button
                size="sm"
                onClick={() => setReceiveModalOpen(true)}
                className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-9 px-4 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Receive Stock
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Owner Branch Location Switcher Pills (Defaults strictly to Active Branch) */}
      {isOwner && branches.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0 font-medium">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            Branch Scope:
          </span>
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/inventory?branchId=${b.id}`}
              className={`px-2.5 py-1 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                (selectedBranchId || "") === b.id
                  ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {b.name} ({b.code})
            </Link>
          ))}
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-card text-xs flex items-center justify-between border animate-slideDown shadow-md ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-status-danger-subtle text-status-danger border-status-danger/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Warehouse Vital Signs Visual Strip */}
      <div className="p-3.5 rounded-card bg-surface border border-border space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-text-primary flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5 text-amber-400" />
            Stock Health Balance ({branchCode})
          </span>
          <span className="text-[11px] text-text-muted">
            {items.length - lowStockCount} Healthy · {lowStockCount - outOfStockCount} Reorder Alerts · {outOfStockCount} Depleted
          </span>
        </div>

        {/* Visual Progress Bar Strip */}
        <div className="h-2 w-full rounded-full bg-surface-elevated overflow-hidden flex">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${items.length > 0 ? ((items.length - lowStockCount) / items.length) * 100 : 100}%` }}
            title="Healthy Stock"
          />
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${items.length > 0 ? ((lowStockCount - outOfStockCount) / items.length) * 100 : 0}%` }}
            title="Low Stock"
          />
          <div
            className="h-full bg-rose-500 transition-all"
            style={{ width: `${items.length > 0 ? (outOfStockCount / items.length) * 100 : 0}%` }}
            title="Out of Stock"
          />
        </div>
      </div>

      {/* Summary Metrics with Organic Ambient Lighting */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 shadow-xs rounded-card">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-text-muted mb-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Active Branch
            </span>
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-text-primary mt-1 truncate relative">
            {branchName}
          </div>
          <div className="text-[10px] text-text-muted font-mono mt-0.5 relative">
            Code: {branchCode}
          </div>
        </Card>

        <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 shadow-xs rounded-card">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-text-muted mb-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Tracked SKUs
            </span>
            <Package className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-text-primary font-mono mt-1 relative">
            {items.length}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5 relative">
            Active in catalog
          </div>
        </Card>

        <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 shadow-xs rounded-card">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-text-muted mb-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Low Stock Warnings
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className={`text-2xl font-black font-mono mt-1 relative ${lowStockCount > 0 ? "text-amber-400" : "text-text-primary"}`}>
            {lowStockCount}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5 relative">
            At or below reorder minimum
          </div>
        </Card>

        <Card className="relative overflow-hidden p-3.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-500/10 via-surface to-surface border border-rose-500/20 hover:border-rose-500/40 transition-all duration-300 shadow-xs rounded-card">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-28 h-14 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-text-muted mb-1 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              Out of Stock
            </span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className={`text-2xl font-black font-mono mt-1 relative ${outOfStockCount > 0 ? "text-rose-400" : "text-text-primary"}`}>
            {outOfStockCount}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5 relative">
            Zero warehouse balance
          </div>
        </Card>
      </div>

      {/* Search & Stock Filter Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter inventory by product name, SKU, or category..."
              className="w-full h-9 pl-9 pr-8 rounded-subtle border border-border bg-surface text-text-primary text-xs focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Stock Health Quick Filter Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => {
                setStockFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                stockFilter === "ALL"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              All Items ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setStockFilter("HEALTHY");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                stockFilter === "HEALTHY"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-emerald-400"
              }`}
            >
              Healthy ({healthyCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStockFilter("LOW");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                stockFilter === "LOW"
                  ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-amber-400"
              }`}
            >
              Low Stock ({lowStockCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setStockFilter("OUT");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-subtle text-xs font-semibold whitespace-nowrap transition-colors ${
                stockFilter === "OUT"
                  ? "bg-rose-500 text-white shadow-xs"
                  : "bg-surface border border-border text-text-secondary hover:text-rose-400"
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>
          </div>
        </div>

        {/* Category Pills (if catalog has multiple categories) */}
        {categories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-text-muted flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3 h-3 text-amber-400" />
              Category:
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-subtle text-[11px] font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? "bg-surface-elevated text-amber-300 border border-amber-500/30"
                    : "bg-surface border border-border/70 text-text-secondary hover:text-text-primary"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Inventory Table with Visual Stock Gauges */}
      <Card className="p-0 overflow-hidden border-border bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="bg-surface-elevated/40 border-b border-border text-text-secondary uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4 w-[28%]">Product Details</th>
                <th className="py-3 px-4 w-[12%]">Category</th>
                <th className="py-3 px-4 w-[14%]">Packaging Unit</th>
                <th className="py-3 px-4 w-[14%] text-right">Selling Price</th>
                <th className="py-3 px-4 w-[16%] text-center">Available Stock & Gauge</th>
                <th className="py-3 px-4 w-[8%] text-center">Status</th>
                <th className="py-3 px-4 w-[8%] text-right pr-5">Movement Trail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-muted text-xs">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No inventory products match the active filters.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const isOutOfStock = item.currentStock <= 0;
                  const isLow = item.currentStock <= item.reorderLevel;
                  const maxBenchmark = Math.max(item.reorderLevel * 2, 1);
                  const percentFull = Math.min(100, Math.round((item.currentStock / maxBenchmark) * 100));

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-surface-elevated/40 transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedProduct(item);
                        setShowAllMovements(false);
                      }}
                    >
                      <td className="py-3 px-4">
                        <p className="font-bold text-text-primary truncate max-w-[220px]">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-bold">
                            {item.sku}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-text-secondary truncate max-w-[120px]">
                        {item.category || "Unassigned"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 inline-block w-fit">
                            {item.bulkUnit}
                          </span>
                          {item.piecesPerBulk > 1 && (
                            <span className="text-[10px] text-text-muted font-mono">
                              1 {item.bulkUnit} = {item.piecesPerBulk} {item.pieceUnit}s
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <div className="font-bold text-text-primary text-xs">
                          {formatNaira(item.sellingPrice)}
                          <span className="text-[10px] text-text-muted font-normal ml-1">/ {item.bulkUnit}</span>
                        </div>
                        {item.piecePrice && (
                          <div className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                            {formatNaira(item.piecePrice)}
                            <span className="text-text-muted font-normal ml-1">/ {item.pieceUnit}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 font-mono font-bold text-xs">
                            <span className={isOutOfStock ? "text-rose-400" : isLow ? "text-amber-400" : "text-text-primary"}>
                              {formatStockDisplay(item.currentStock, item.bulkUnit, item.pieceUnit, item.piecesPerBulk)}
                            </span>
                          </div>
                          <div className="text-[10px] text-text-muted font-mono">
                            {item.piecesPerBulk > 1 ? `${item.currentStock} ${item.pieceUnit}s | ` : ""}min {item.piecesPerBulk > 1 ? `${Math.ceil(item.reorderLevel / item.piecesPerBulk)} ${item.bulkUnit}s` : `${item.reorderLevel} ${item.bulkUnit}s`}
                          </div>
                          {/* Mini Visual Gauge */}
                          <div className="w-24 h-1.5 rounded-full bg-surface-elevated overflow-hidden border border-border/60">
                            <div
                              className={`h-full transition-all ${
                                isOutOfStock
                                  ? "bg-rose-500 w-0"
                                  : isLow
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${percentFull}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            Healthy
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right pr-5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(item);
                            setShowAllMovements(false);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center justify-end gap-1 ml-auto"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Audit Trail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-border bg-surface-elevated/20 text-xs">
            <span className="text-text-muted">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredItems.length)} of{" "}
              {filteredItems.length} products
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-border bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-elevated text-text-primary flex items-center gap-1 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="px-2 font-mono text-text-primary font-semibold">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded border border-border bg-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-elevated text-text-primary flex items-center gap-1 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Stock Detail Modal Card (Strictly Viewport Contained, max-h-[85vh]) */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] bg-surface border border-border rounded-card flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Fixed Card Header */}
            <div className="px-5 py-3.5 border-b border-border bg-surface-elevated/40 flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-text-primary truncate">
                    {selectedProduct.name}
                  </h3>
                  {selectedProduct.category && (
                    <span className="text-[10px] text-text-muted px-2 py-0.5 rounded-full bg-surface-elevated border border-border shrink-0">
                      {selectedProduct.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-text-muted font-mono">
                  <span className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                    {selectedProduct.sku}
                  </span>
                  <span>·</span>
                  <span>
                    1 {selectedProduct.bulkUnit}
                    {selectedProduct.piecesPerBulk > 1 ? ` = ${selectedProduct.piecesPerBulk} ${selectedProduct.pieceUnit}s` : ""}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-subtle hover:bg-surface-elevated text-text-muted hover:text-text-primary transition-colors shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 2. Scrollable Body (Guaranteed to fit viewport within 85vh) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Quick KPI Strip: 3 Columns */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-card bg-surface-elevated/40 border border-border">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Available Stock</span>
                  <div className="text-sm font-bold text-text-primary mt-1 font-mono">
                    {formatStockDisplay(selectedProduct.currentStock, selectedProduct.bulkUnit, selectedProduct.pieceUnit, selectedProduct.piecesPerBulk)}
                  </div>
                  {selectedProduct.piecesPerBulk > 1 && (
                    <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                      {selectedProduct.currentStock} {selectedProduct.pieceUnit}s total
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-card bg-surface-elevated/40 border border-border">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Selling Price</span>
                  <div className="text-sm font-bold text-text-primary mt-1 font-mono">
                    {formatNaira(selectedProduct.sellingPrice)}
                    <span className="text-[10px] text-text-muted font-normal block font-sans">per {selectedProduct.bulkUnit}</span>
                  </div>
                  {selectedProduct.piecePrice && (
                    <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                      {formatNaira(selectedProduct.piecePrice)} / {selectedProduct.pieceUnit}
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-card bg-surface-elevated/40 border border-border">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Reorder Threshold</span>
                  <div className="text-sm font-bold text-amber-400 mt-1 font-mono">
                    {selectedProduct.piecesPerBulk > 1
                      ? `${Math.ceil(selectedProduct.reorderLevel / selectedProduct.piecesPerBulk)} ${selectedProduct.bulkUnit}s`
                      : `${selectedProduct.reorderLevel} ${selectedProduct.bulkUnit}s`}
                  </div>
                  {selectedProduct.piecesPerBulk > 1 && (
                    <span className="text-[10px] text-text-muted font-mono block mt-0.5">
                      min {selectedProduct.reorderLevel} {selectedProduct.pieceUnit}s
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Stock Health Bar */}
              {(() => {
                const isOutOfStock = selectedProduct.currentStock <= 0;
                const isLow = selectedProduct.currentStock <= selectedProduct.reorderLevel;
                const benchmark = Math.max(selectedProduct.reorderLevel * 2, 1);
                const percent = Math.min(100, Math.round((selectedProduct.currentStock / benchmark) * 100));

                return (
                  <div className="p-3 rounded-card bg-surface-elevated/20 border border-border flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-text-secondary font-medium">Stock Level Health</span>
                        <span className="font-mono text-text-muted text-[11px]">{percent}% of benchmark</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface-elevated overflow-hidden border border-border">
                        <div
                          className={`h-full transition-all ${
                            isOutOfStock
                              ? "bg-rose-500 w-0"
                              : isLow
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Low Stock Warning
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          Stock Level Healthy
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Recent Ledger Activity */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-amber-400" />
                    <span>Recent Movement Activity</span>
                  </h4>
                  {selectedProduct.movements.length > 0 && (
                    <span className="text-[10px] text-text-muted bg-surface-elevated px-2 py-0.5 rounded border border-border">
                      {showAllMovements
                        ? `All ${selectedProduct.movements.length} records`
                        : `Latest ${Math.min(4, selectedProduct.movements.length)} of ${selectedProduct.movements.length}`}
                    </span>
                  )}
                </div>

                {selectedProduct.movements.length === 0 ? (
                  <p className="text-xs text-text-muted py-5 text-center bg-surface-elevated/10 rounded-card border border-border/50">
                    No movement records found for this product.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {(showAllMovements
                      ? selectedProduct.movements
                      : selectedProduct.movements.slice(0, 4)
                    ).map((m) => {
                      const isAddition = ["PURCHASE", "OPENING_STOCK", "TRANSFER_IN", "RETURN_IN"].includes(m.type);
                      return (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-card bg-surface-elevated/20 border border-border text-xs flex items-center justify-between gap-3 hover:bg-surface-elevated/30 transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-text-primary">
                                {m.type.replace(/_/g, " ")}
                              </span>
                              <span className="text-[10px] text-text-muted">
                                {formatDateTime(m.createdAt)}
                              </span>
                            </div>
                            <p className="text-[11px] text-text-secondary mt-0.5 truncate">
                              {m.reason || "Standard inventory event"}
                              <span className="text-text-muted font-normal ml-2">by {m.employeeName}</span>
                            </p>
                          </div>

                          <div className="text-right font-mono font-bold text-sm shrink-0">
                            <span className={isAddition ? "text-status-success" : "text-status-danger"}>
                              {isAddition ? `+${m.quantity}` : `-${m.quantity}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {selectedProduct.movements.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllMovements(!showAllMovements)}
                        className="w-full py-1.5 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 bg-surface-elevated/30 hover:bg-surface-elevated rounded-subtle border border-border transition-colors mt-1"
                      >
                        {showAllMovements
                          ? "Collapse to 4 Recent Records"
                          : `Show All ${selectedProduct.movements.length} Recent Movements`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 3. Fixed Card Footer */}
            <div className="px-5 py-3 border-t border-border bg-surface-elevated/40 flex items-center justify-between gap-3 shrink-0">
              <Link
                href="/activity?window=24h"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                <span>Open Full Stock Audit in Activity Hub →</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="px-4 py-1.5 rounded-subtle bg-surface-elevated hover:bg-surface-elevated/80 text-text-primary text-xs font-semibold border border-border transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Stock Modal */}
      {receiveModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleReceiveStock}
            className="bg-surface border border-border rounded-sheet max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand" />
                <span>Receive Supplier Stock Shipment</span>
              </h3>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Select Product:</label>
                <select
                  value={receiveProductId}
                  onChange={(e) => {
                    setReceiveProductId(e.target.value);
                    setReceiveUnitType("BULK");
                  }}
                  className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {items.map((i) => (
                    <option key={i.productId} value={i.productId}>
                      {i.name} ({i.bulkUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-Unit Toggle for Receiving */}
              {(() => {
                const prod = items.find((i) => i.productId === receiveProductId);
                if (!prod) return null;
                const hasMultiUnit = prod.piecesPerBulk > 1;

                return (
                  <div className="space-y-2">
                    {hasMultiUnit && (
                      <div>
                        <label className="block text-text-secondary mb-1">Packaging Scale:</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-elevated/40 border border-border rounded-lg">
                          <button
                            type="button"
                            onClick={() => setReceiveUnitType("BULK")}
                            className={`py-1.5 px-3 rounded text-xs font-semibold transition-all ${
                              receiveUnitType === "BULK"
                                ? "bg-amber-500 text-slate-950 shadow-sm"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            Bulk ({prod.bulkUnit})
                          </button>
                          <button
                            type="button"
                            onClick={() => setReceiveUnitType("PIECE")}
                            className={`py-1.5 px-3 rounded text-xs font-semibold transition-all ${
                              receiveUnitType === "PIECE"
                                ? "bg-amber-500 text-slate-950 shadow-sm"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            Loose ({prod.pieceUnit})
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-text-secondary mb-1">
                        Quantity Received ({receiveUnitType === "BULK" ? prod.bulkUnit : prod.pieceUnit}):
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={receiveQuantity}
                        onChange={(e) => setReceiveQuantity(e.target.value)}
                        className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="p-2.5 rounded-subtle bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                      {receiveUnitType === "BULK" && hasMultiUnit ? (
                        <span>
                          Receiving <strong>{receiveQuantity || 0} {prod.bulkUnit}s</strong> will add{" "}
                          <strong>{(Number(receiveQuantity) || 0) * prod.piecesPerBulk} total {prod.pieceUnit}s</strong> to branch inventory stock.
                        </span>
                      ) : (
                        <span>
                          Receiving <strong>{receiveQuantity || 0} {hasMultiUnit ? prod.pieceUnit : prod.bulkUnit}s</strong> to branch inventory stock.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-text-secondary mb-1">Supplier / Distributor:</label>
                <input
                  type="text"
                  value={receiveSupplier}
                  onChange={(e) => setReceiveSupplier(e.target.value)}
                  placeholder="e.g. Nigerian Breweries, Guinness Nig"
                  className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Delivery / Waybill Reference:</label>
                <input
                  type="text"
                  value={receiveRef}
                  onChange={(e) => setReceiveRef(e.target.value)}
                  placeholder="e.g. WB-89410"
                  className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceiveModalOpen(false)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={isReceiving}
                className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                Confirm Receipt
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Record Damage Modal */}
      {damageModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordDamage}
            className="bg-surface border border-border rounded-sheet max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-status-danger" />
                <span>Log Damaged / Expired Inventory</span>
              </h3>
              <button
                type="button"
                onClick={() => setDamageModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary mb-1">Select Product:</label>
                <select
                  value={damageProductId}
                  onChange={(e) => {
                    setDamageProductId(e.target.value);
                    setDamageUnitType("BULK");
                  }}
                  className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {items.map((i) => (
                    <option key={i.productId} value={i.productId}>
                      {i.name} | Available: {formatStockDisplay(i.currentStock, i.bulkUnit, i.pieceUnit, i.piecesPerBulk)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-Unit Toggle for Damage Logging */}
              {(() => {
                const prod = items.find((i) => i.productId === damageProductId);
                if (!prod) return null;
                const hasMultiUnit = prod.piecesPerBulk > 1;

                return (
                  <div className="space-y-2">
                    {hasMultiUnit && (
                      <div>
                        <label className="block text-text-secondary mb-1">Packaging Scale:</label>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-elevated/40 border border-border rounded-lg">
                          <button
                            type="button"
                            onClick={() => setDamageUnitType("BULK")}
                            className={`py-1.5 px-3 rounded text-xs font-semibold transition-all ${
                              damageUnitType === "BULK"
                                ? "bg-rose-500 text-white shadow-sm"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            Bulk ({prod.bulkUnit})
                          </button>
                          <button
                            type="button"
                            onClick={() => setDamageUnitType("PIECE")}
                            className={`py-1.5 px-3 rounded text-xs font-semibold transition-all ${
                              damageUnitType === "PIECE"
                                ? "bg-rose-500 text-white shadow-sm"
                                : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            Loose ({prod.pieceUnit})
                          </button>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-text-secondary mb-1">
                        Damaged Quantity ({damageUnitType === "BULK" ? prod.bulkUnit : prod.pieceUnit}):
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={damageQuantity}
                        onChange={(e) => setDamageQuantity(e.target.value)}
                        className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                      />
                    </div>

                    <div className="p-2.5 rounded-subtle bg-surface-elevated/60 border border-border text-[11px] text-text-muted">
                      Available: <strong className="text-text-primary">{formatStockDisplay(prod.currentStock, prod.bulkUnit, prod.pieceUnit, prod.piecesPerBulk)}</strong>
                      {hasMultiUnit && ` (${prod.currentStock} ${prod.pieceUnit}s total)`}.
                      {damageUnitType === "BULK" && hasMultiUnit ? (
                        <span className="block mt-1 text-rose-400 font-medium">
                          Will deduct {(Number(damageQuantity) || 0) * prod.piecesPerBulk} total {prod.pieceUnit}s from stock.
                        </span>
                      ) : (
                        <span className="block mt-1 text-rose-400 font-medium">
                          Will deduct {damageQuantity || 0} {hasMultiUnit ? prod.pieceUnit : prod.bulkUnit}s from stock.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-text-secondary mb-1">Cause / Reason:</label>
                <select
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="Broken bottles during unloading">Broken bottles during unloading</option>
                  <option value="Packaging crushed in storage">Packaging crushed in storage</option>
                  <option value="Product expired past sell-by date">Product expired past sell-by date</option>
                  <option value="Customer return defective">Customer return defective</option>
                  <option value="Factory defect / seal broken">Factory defect / seal broken</option>
                </select>
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Notes (Optional):</label>
                <textarea
                  rows={2}
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  placeholder="Additional context for management audit..."
                  className="w-full p-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDamageModalOpen(false)}
                className="flex-1 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                isLoading={isDamaging}
                className="flex-1 text-xs"
              >
                Confirm Deduction
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
