"use client";

import React, { useState, useMemo } from "react";
import {
  Ruler,
  Plus,
  Edit2,
  Trash2,
  Search,
  X,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Package,
  Layers,
  Info,
  Wine,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UnitItem } from "./types";

interface UnitsTabProps {
  units: UnitItem[];
  setUnits: React.Dispatch<React.SetStateAction<UnitItem[]>>;
  showToast: (type: "success" | "error", text: string) => void;
  openAddModal: boolean;
  setOpenAddModal: (open: boolean) => void;
}

export const UnitsTab: React.FC<UnitsTabProps> = ({
  units,
  setUnits,
  showToast,
  openAddModal,
  setOpenAddModal,
}) => {
  const [search, setSearch] = useState("");
  const [scaleFilter, setScaleFilter] = useState<"ALL" | "BULK" | "PIECE">("ALL");
  const [editItem, setEditItem] = useState<UnitItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<UnitItem | null>(null);

  // Form states
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formScaleType, setFormScaleType] = useState<"BULK" | "PIECE" | "UNIVERSAL">("BULK");
  const [formDefaultPieceUnit, setFormDefaultPieceUnit] = useState<string>("BOTTLE");
  const [formDefaultRatio, setFormDefaultRatio] = useState<string>("24");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      const matchesScale =
        scaleFilter === "ALL"
          ? true
          : scaleFilter === "BULK"
          ? u.scaleType === "BULK" || u.scaleType === "UNIVERSAL"
          : u.scaleType === "PIECE" || u.scaleType === "UNIVERSAL";

      const q = search.toLowerCase().trim();
      if (!q) return matchesScale;
      return (
        matchesScale &&
        (u.code.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q) ||
          (u.description && u.description.toLowerCase().includes(q)))
      );
    });
  }, [units, search, scaleFilter]);

  const bulkUnitsCount = units.filter((u) => u.scaleType === "BULK").length;
  const pieceUnitsCount = units.filter((u) => u.scaleType === "PIECE").length;
  const universalUnitsCount = units.filter((u) => u.scaleType === "UNIVERSAL").length;
  const unitsInUseCount = units.filter((u) => u.productsCount > 0).length;

  const availablePieceUnits = useMemo(() => {
    return units.filter((u) => u.scaleType === "PIECE" || u.scaleType === "UNIVERSAL");
  }, [units]);

  const handleOpenAdd = () => {
    setFormCode("");
    setFormName("");
    setFormDesc("");
    setFormScaleType("BULK");
    setFormDefaultPieceUnit("BOTTLE");
    setFormDefaultRatio("24");
    setFormError(null);
    setOpenAddModal(true);
  };

  const handleOpenEdit = (unit: UnitItem) => {
    setEditItem(unit);
    setFormCode(unit.code);
    setFormName(unit.name);
    setFormDesc(unit.description || "");
    setFormScaleType(unit.scaleType || "UNIVERSAL");
    setFormDefaultPieceUnit(unit.defaultPieceUnit || "BOTTLE");
    setFormDefaultRatio(unit.defaultRatio ? unit.defaultRatio.toString() : "24");
    setFormError(null);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editItem) {
        // Edit existing unit
        const res = await fetch(`/api/settings/units/${editItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            description: formDesc,
            scaleType: formScaleType,
            defaultPieceUnit: formScaleType === "BULK" ? formDefaultPieceUnit || null : null,
            defaultRatio: formScaleType === "BULK" ? (formDefaultRatio ? parseInt(formDefaultRatio, 10) : null) : null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update unit.");

        setUnits((prev) =>
          prev.map((u) => (u.id === editItem.id ? { ...u, ...data.unit } : u))
        );
        setEditItem(null);
        showToast("success", `Unit '${data.unit.name}' updated successfully.`);
      } else {
        // Create new unit
        const res = await fetch("/api/settings/units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: formCode,
            name: formName,
            description: formDesc,
            scaleType: formScaleType,
            defaultPieceUnit: formScaleType === "BULK" ? formDefaultPieceUnit || null : null,
            defaultRatio: formScaleType === "BULK" ? (formDefaultRatio ? parseInt(formDefaultRatio, 10) : null) : null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create unit.");

        const newUnit: UnitItem = {
          id: data.unit.id,
          code: data.unit.code,
          name: data.unit.name,
          description: data.unit.description,
          scaleType: data.unit.scaleType || formScaleType,
          defaultPieceUnit: data.unit.defaultPieceUnit || (formScaleType === "BULK" ? formDefaultPieceUnit : null),
          defaultRatio: data.unit.defaultRatio || (formScaleType === "BULK" ? parseInt(formDefaultRatio, 10) : null),
          isDefault: data.unit.isDefault,
          productsCount: 0,
          bulkProductsCount: 0,
          pieceProductsCount: 0,
          createdAt: data.unit.createdAt,
        };

        setUnits((prev) => [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name)));
        setOpenAddModal(false);
        showToast("success", `Unit '${newUnit.name}' (${newUnit.code}) created successfully.`);
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unit: UnitItem) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/settings/units/${unit.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete unit.");

      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setDeleteCandidate(null);
      showToast("success", `Unit '${unit.name}' (${unit.code}) deleted successfully.`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete unit.");
      setDeleteCandidate(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-surface border-border">
          <div className="text-[11px] font-medium text-text-muted">Total Packaging Scales</div>
          <div className="text-xl font-bold text-text-primary mt-1">{units.length}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Configured system scales</div>
        </Card>

        <Card className="p-3.5 bg-surface border-cyan-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/10 via-surface to-surface">
          <div className="text-[11px] font-medium text-cyan-400">Bulk Wholesale Scales</div>
          <div className="text-xl font-bold text-cyan-300 mt-1">{bulkUnitsCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Crates, Cartons, Packs, Bags</div>
        </Card>

        <Card className="p-3.5 bg-surface border-amber-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-surface to-surface">
          <div className="text-[11px] font-medium text-amber-400">Single Item / Loose Units</div>
          <div className="text-xl font-bold text-amber-300 mt-1">{pieceUnitsCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Bottles, Cans, Pieces, Sachets</div>
        </Card>

        <Card className="p-3.5 bg-surface border-emerald-500/20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-surface to-surface">
          <div className="text-[11px] font-medium text-emerald-400">Assigned In Catalog</div>
          <div className="text-xl font-bold text-emerald-300 mt-1">{unitsInUseCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Actively mapped to products</div>
        </Card>
      </div>

      {/* Dual Packaging Policy Notice */}
      <Card className="p-4 bg-surface border-border">
        <div className="flex items-start gap-3">
          <Boxes className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-text-primary">
              Standardized Packaging Scales & Dual Retail Architecture
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Frank<span className="text-amber-400 font-semibold">Lucy</span> supports both wholesale packaging scales (Crates, Cartons, Packs, Kegs) and loose single-item units (Bottles, Cans, Pieces, Sachets). Cashiers can sell loose individual bottles or full bulk crates directly on the POS, with automatic inventory base-piece decrementing and concurrency locks.
            </p>
          </div>
        </div>
      </Card>

      {/* Filter and Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-subtle border border-border">
        {/* Scale Type Filter Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/40 border border-border rounded-lg">
          <button
            type="button"
            onClick={() => setScaleFilter("ALL")}
            className={`py-1 px-3 rounded-md text-xs font-semibold transition-all ${
              scaleFilter === "ALL"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            All Scales ({units.length})
          </button>
          <button
            type="button"
            onClick={() => setScaleFilter("BULK")}
            className={`py-1 px-3 rounded-md text-xs font-semibold transition-all ${
              scaleFilter === "BULK"
                ? "bg-cyan-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Bulk Packaging ({bulkUnitsCount + universalUnitsCount})
          </button>
          <button
            type="button"
            onClick={() => setScaleFilter("PIECE")}
            className={`py-1 px-3 rounded-md text-xs font-semibold transition-all ${
              scaleFilter === "PIECE"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Single Item Units ({pieceUnitsCount + universalUnitsCount})
          </button>
        </div>

        {/* Search & Add Action */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search units by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-amber-400"
            />
          </div>

          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Scale</span>
          </Button>
        </div>
      </div>

      {/* Units Executive Grid */}
      {filteredUnits.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-border">
          <Boxes className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
          <p className="text-xs text-text-muted">No units of measurement match your search criteria.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredUnits.map((u) => {
            const isBulk = u.scaleType === "BULK";
            const isPiece = u.scaleType === "PIECE";

            return (
              <Card
                key={u.id}
                className={`relative overflow-hidden p-4 bg-surface border transition-all duration-300 flex flex-col justify-between shadow-xs rounded-card ${
                  isBulk
                    ? "border-cyan-500/20 hover:border-cyan-500/40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/[0.06] via-surface to-surface"
                    : isPiece
                    ? "border-amber-500/20 hover:border-amber-500/40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/[0.06] via-surface to-surface"
                    : "border-border hover:border-border-hover"
                }`}
              >
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span
                      className={`font-mono font-bold text-xs px-2.5 py-0.5 rounded-xs border ${
                        isBulk
                          ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                          : isPiece
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : "bg-surface-elevated text-text-secondary border-border"
                      }`}
                    >
                      {u.code}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                        isBulk
                          ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                          : isPiece
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {isBulk ? "Bulk Scale" : isPiece ? "Single Item Unit" : "Universal Scale"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                      {isPiece ? <Wine className="w-3.5 h-3.5 text-amber-400" /> : <Package className="w-3.5 h-3.5 text-cyan-400" />}
                      <span>{u.name}</span>
                    </h4>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">
                      {u.description || <span className="italic text-text-muted">No description provided</span>}
                    </p>

                    {isBulk && (
                      <div className="mt-2.5 p-2 rounded-lg bg-surface-elevated/70 border border-cyan-500/20 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-cyan-400 font-semibold flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            Default Retail Unit:
                          </span>
                          <span className="font-mono font-bold text-cyan-200">
                            {u.defaultPieceUnit || "Not Linked"}
                          </span>
                        </div>
                        {u.defaultPieceUnit && u.defaultRatio ? (
                          <div className="text-[10px] text-text-muted flex items-center justify-between pt-0.5 border-t border-border/40">
                            <span>Standard Ratio:</span>
                            <span className="font-mono text-cyan-300/90 font-medium">
                              1 {u.code} = {u.defaultRatio} {u.defaultPieceUnit}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                  <div>
                    {u.productsCount > 0 ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        {u.bulkProductsCount && u.bulkProductsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {u.bulkProductsCount} as Bulk
                          </span>
                        ) : null}
                        {u.pieceProductsCount && u.pieceProductsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {u.pieceProductsCount} as Single Item
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[10px] text-text-muted px-2 py-0.5 rounded bg-surface-elevated">
                        Unassigned
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(u)}
                      className="h-7 px-2 text-xs text-text-secondary hover:text-text-primary"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteCandidate(u)}
                      disabled={u.productsCount > 0}
                      title={
                        u.productsCount > 0
                          ? "Cannot delete: currently assigned to products"
                          : "Delete unit"
                      }
                      className="h-7 px-2 text-xs text-status-danger hover:bg-status-danger-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT UNIT */}
      {/* ========================================================================= */}
      {(openAddModal || editItem) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface/95 backdrop-blur-2xl border border-white/10 max-w-md w-full shadow-2xl rounded-card flex flex-col max-h-[88vh] overflow-hidden animate-scaleUp">
            {/* Modal Header */}
            <div className="p-5 pb-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Ruler className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    {editItem ? `Edit Scale: ${editItem.name}` : "Create Packaging Scale / Unit"}
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {editItem ? "Update scale parameters & classification" : "Standardize wholesale outer cases or retail single-item units"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenAddModal(false);
                  setEditItem(null);
                }}
                className="w-7 h-7 rounded-md hover:bg-surface-elevated text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form id="unit-form" onSubmit={handleSaveUnit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs font-medium">
                  {formError}
                </div>
              )}

              <div className="space-y-3.5">
                {/* Scale Category Selector */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Scale Classification *
                  </label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-surface-elevated/40 border border-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormScaleType("BULK")}
                      className={`py-2 px-2 rounded-md text-xs font-semibold transition-all ${
                        formScaleType === "BULK"
                          ? "bg-cyan-500 text-slate-950 shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      Bulk Wholesale
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormScaleType("PIECE")}
                      className={`py-2 px-2 rounded-md text-xs font-semibold transition-all ${
                        formScaleType === "PIECE"
                          ? "bg-amber-500 text-slate-950 shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      Single Item Unit
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormScaleType("UNIVERSAL")}
                      className={`py-2 px-2 rounded-md text-xs font-semibold transition-all ${
                        formScaleType === "UNIVERSAL"
                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                          : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      Universal
                    </button>
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 block">
                    {formScaleType === "BULK"
                      ? "Outer bulk packaging for wholesale replenishment (e.g. Crate, Carton, Pack, Bag, Keg)."
                      : formScaleType === "PIECE"
                      ? "Individual single item sold loose to retail buyers (e.g. Bottle, Can, Piece, Sachet)."
                      : "Can be utilized flexibly as either wholesale bulk or standalone retail unit."}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Unit Code (Unique Identifier) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editItem}
                    placeholder="e.g. CARTON, BOTTLE, PACK"
                    value={formCode}
                    onChange={(e) =>
                      setFormCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                    }
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg font-mono text-xs text-text-primary focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 disabled:opacity-50 transition-all font-bold"
                  />
                  {editItem ? (
                    <span className="text-[10px] text-text-muted mt-1 block">
                      Unit code cannot be altered after creation to protect product catalog references.
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-muted mt-1 block">
                      Short uppercase alphanumeric identifier (e.g. CRATE, BOTTLE, CAN, CARTON, KEG).
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Crate (24 Bottles), Single Bottle"
                    value={formName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setFormName(newName);
                      if (!editItem && (!formCode || formCode === formName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))) {
                        setFormCode(newName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
                  />
                </div>

                {/* Bulk Scale Pairing Section */}
                {formScaleType === "BULK" && (
                  <div className="p-3.5 rounded-lg bg-cyan-500/[0.05] border border-cyan-500/20 space-y-3">
                    <div className="flex items-start gap-2 text-cyan-400">
                      <Link2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs">Retail Single Item Pairing (Auto-Inference)</span>
                        <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">
                          When catalog products select this bulk scale, the system will automatically prefill this retail piece unit and default capacity.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">
                          Default Retail Piece Unit
                        </label>
                        <select
                          value={formDefaultPieceUnit}
                          onChange={(e) => setFormDefaultPieceUnit(e.target.value)}
                          className="w-full px-2.5 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-cyan-400 font-medium"
                        >
                          <option value="">No Default Unit</option>
                          {availablePieceUnits.map((pu) => (
                            <option key={pu.id} value={pu.code}>
                              {pu.name} ({pu.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">
                          Default Capacity (Pieces / Bulk)
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 24, 12, 6, 50"
                          value={formDefaultRatio}
                          onChange={(e) => setFormDefaultRatio(e.target.value)}
                          className="w-full px-2.5 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                    </div>

                    {formDefaultPieceUnit && formDefaultRatio ? (
                      <div className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-3 py-1.5 rounded border border-cyan-500/20 flex items-center justify-between">
                        <span className="text-[10px] text-cyan-400 font-sans font-medium">Standard Capacity:</span>
                        <span className="font-bold">
                          1 {formCode || "BULK"} = {formDefaultRatio} {formDefaultPieceUnit}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1.5">
                    Description & Packaging Specifications
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Wholesale outer crate holding 24 glass bottles."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 resize-none transition-all leading-relaxed"
                  />
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-surface/50 backdrop-blur-sm flex justify-end gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpenAddModal(false);
                  setEditItem(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="unit-form"
                size="sm"
                disabled={isSubmitting}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 shadow-sm"
              >
                {isSubmitting ? "Saving..." : editItem ? "Update Scale" : "Create Scale"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================================= */}
      {deleteCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-surface/95 backdrop-blur-2xl border border-white/10 max-w-sm w-full p-5 shadow-2xl rounded-card flex flex-col max-h-[88vh] overflow-y-auto space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-status-danger">
              <div className="w-9 h-9 rounded-lg bg-status-danger/10 border border-status-danger/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Delete Unit of Measurement?</h3>
                <p className="text-[10px] text-text-muted mt-0.5">Permanent catalog alteration</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to delete unit <strong className="text-text-primary">{deleteCandidate.name}</strong> ({deleteCandidate.code})?
            </p>

            {deleteCandidate.productsCount > 0 ? (
              <div className="p-3 bg-status-danger-subtle border border-status-danger/30 rounded-lg text-[11px] text-status-danger leading-relaxed">
                <strong className="block font-bold mb-1">Cannot Delete In-Use Unit:</strong>
                There are {deleteCandidate.productsCount} products in your catalog currently assigned to this unit
                {deleteCandidate.bulkProductsCount ? ` (${deleteCandidate.bulkProductsCount} as Bulk Packaging)` : ""}
                {deleteCandidate.pieceProductsCount ? ` (${deleteCandidate.pieceProductsCount} as Single Item Unit)` : ""}.
                You must reassign or remove those products before this unit can be deleted.
              </div>
            ) : (
              <p className="text-[11px] text-text-muted">
                This unit is not referenced by any product in your catalog and can be safely removed.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteCandidate(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={deleteCandidate.productsCount > 0 || isSubmitting}
                onClick={() => handleDeleteUnit(deleteCandidate)}
                className="bg-status-danger hover:bg-status-danger/90 text-white text-xs font-semibold px-4"
              >
                {isSubmitting ? "Deleting..." : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
