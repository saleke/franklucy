"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Package,
  Calendar,
  User,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export interface TransferRecord {
  id: string;
  referenceNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  sourceBranchCode: string;
  destinationBranchId: string;
  destinationBranchName: string;
  destinationBranchCode: string;
  employeeName: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  items: {
    productId: string;
    productName: string;
    productSku: string;
    quantity: number;
    unit: string;
    unitType?: string;
    piecesTransferred?: number;
  }[];
}

export interface AvailableProduct {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  inventoryUnit: string;
  bulkUnit?: string;
  pieceUnit?: string;
  piecesPerBulk?: number;
}

export interface TargetBranch {
  id: string;
  name: string;
  code: string;
}

interface TransfersWorkspaceProps {
  currentBranchId: string;
  currentBranchName: string;
  currentBranchCode: string;
  availableProducts: AvailableProduct[];
  branches: TargetBranch[];
  initialTransfers: TransferRecord[];
  isOwner?: boolean;
  activeWindow?: string;
  selectedBranchId?: string;
}

export function formatStockDisplay(
  currentStockPieces: number,
  bulkUnit: string = "CRATE",
  pieceUnit: string = "PIECE",
  piecesPerBulk: number = 1
): string {
  if (currentStockPieces <= 0) return "0 in stock";
  if (piecesPerBulk <= 1) {
    return `${currentStockPieces.toLocaleString()} ${bulkUnit}s`;
  }
  const fullBulk = Math.floor(currentStockPieces / piecesPerBulk);
  const loose = currentStockPieces % piecesPerBulk;
  if (fullBulk > 0 && loose > 0) {
    return `${fullBulk} ${bulkUnit}${fullBulk > 1 ? "s" : ""} + ${loose} ${pieceUnit}${loose > 1 ? "s" : ""}`;
  }
  if (fullBulk > 0) {
    return `${fullBulk} ${bulkUnit}${fullBulk > 1 ? "s" : ""}`;
  }
  return `${loose} ${pieceUnit}${loose > 1 ? "s" : ""}`;
}

export function formatTransferItemSummary(items: TransferRecord["items"]): string {
  const map = new Map<string, { name: string; parts: string[] }>();
  for (const item of items) {
    if (!map.has(item.productId)) {
      map.set(item.productId, { name: item.productName, parts: [] });
    }
    const unitName = item.unit || "unit";
    map.get(item.productId)!.parts.push(`${item.quantity} ${unitName}`);
  }
  return Array.from(map.values())
    .map((e) => `${e.name} (${e.parts.join(" + ")})`)
    .join(", ");
}

export function TransfersWorkspace({
  currentBranchId,
  currentBranchName,
  currentBranchCode,
  availableProducts,
  branches,
  initialTransfers,
  isOwner = false,
  activeWindow = "24h",
  selectedBranchId,
}: TransfersWorkspaceProps) {
  const router = useRouter();
  const [transfers, setTransfers] = useState<TransferRecord[]>(initialTransfers);
  const [productsList, setProductsList] = useState<AvailableProduct[]>(availableProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "OUTGOING" | "INCOMING">("ALL");

  const handleWindowChange = (newWindow: string) => {
    const params = new URLSearchParams();
    params.set("window", newWindow);
    if (selectedBranchId) {
      params.set("branchId", selectedBranchId);
    }
    router.push(`/transfers?${params.toString()}`);
  };

  const handleBranchChange = (newBranchId: string) => {
    const params = new URLSearchParams();
    if (activeWindow) {
      params.set("window", activeWindow);
    }
    if (newBranchId) {
      params.set("branchId", newBranchId);
    }
    router.push(`/transfers?${params.toString()}`);
  };

  // Keep state synchronized when server props change (solves the ghost transfer bug)
  useEffect(() => {
    setTransfers(initialTransfers);
  }, [initialTransfers]);

  useEffect(() => {
    setProductsList(availableProducts);
  }, [availableProducts]);

  // New Transfer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [destinationBranchId, setDestinationBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [transferItems, setTransferItems] = useState<{
    productId: string;
    bulkQuantity: number;
    pieceQuantity: number;
  }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successDetails, setSuccessDetails] = useState<{ referenceNumber: string } | null>(null);

  // Transfer Detail Drawer State
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);

  // Available destination branches (exclude current)
  const destinationBranches = branches.filter((b) => b.id !== currentBranchId);

  // Filter transfers
  const filteredTransfers = transfers.filter((t) => {
    const isOutgoing = t.sourceBranchId === currentBranchId;
    const isIncoming = t.destinationBranchId === currentBranchId;

    if (directionFilter === "OUTGOING" && !isOutgoing) return false;
    if (directionFilter === "INCOMING" && !isIncoming) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const refMatch = t.referenceNumber.toLowerCase().includes(q);
      const userMatch = t.employeeName.toLowerCase().includes(q);
      const branchMatch =
        t.sourceBranchName.toLowerCase().includes(q) ||
        t.destinationBranchName.toLowerCase().includes(q);
      const itemMatch = t.items.some(
        (i) => i.productName.toLowerCase().includes(q) || i.productSku.toLowerCase().includes(q)
      );
      if (!refMatch && !userMatch && !branchMatch && !itemMatch) return false;
    }
    return true;
  });

  // Calculate metrics
  const totalTransfers = transfers.length;
  const outgoingCount = transfers.filter((t) => t.sourceBranchId === currentBranchId).length;
  const incomingCount = transfers.filter((t) => t.destinationBranchId === currentBranchId).length;
  const totalUnitsMoved = transfers.reduce(
    (acc, t) => acc + t.items.reduce((s, i) => s + (i.piecesTransferred || i.quantity), 0),
    0
  );

  const handleAddItem = (productId: string) => {
    if (!productId) return;
    if (transferItems.some((i) => i.productId === productId)) return;
    setTransferItems([
      ...transferItems,
      { productId, bulkQuantity: 1, pieceQuantity: 0 },
    ]);
  };

  const handleUpdateBulkQty = (productId: string, quantity: number) => {
    setTransferItems(
      transferItems.map((item) =>
        item.productId === productId ? { ...item, bulkQuantity: Math.max(0, quantity) } : item
      )
    );
  };

  const handleUpdatePieceQty = (productId: string, quantity: number) => {
    setTransferItems(
      transferItems.map((item) =>
        item.productId === productId ? { ...item, pieceQuantity: Math.max(0, quantity) } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setTransferItems(transferItems.filter((i) => i.productId !== productId));
  };

  const handleSubmitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinationBranchId) {
      setErrorMessage("Please select a destination branch.");
      return;
    }
    if (transferItems.length === 0) {
      setErrorMessage("Please add at least one product to transfer.");
      return;
    }

    const apiItems: { productId: string; quantity: number; unitType: "BULK" | "PIECE" }[] = [];

    // Client-side stock validation
    for (const item of transferItems) {
      const prod = productsList.find((p) => p.id === item.productId);
      if (!prod) continue;
      const mult = prod.piecesPerBulk || 1;
      const totalPieces = item.bulkQuantity * mult + item.pieceQuantity;

      if (totalPieces <= 0) {
        setErrorMessage(`Please enter a quantity greater than zero for "${prod.name}".`);
        return;
      }

      if (totalPieces > prod.currentStock) {
        setErrorMessage(
          `Transfer quantity for "${prod.name}" (${totalPieces} pieces) exceeds available stock (${formatStockDisplay(
            prod.currentStock,
            prod.bulkUnit,
            prod.pieceUnit,
            prod.piecesPerBulk
          )}).`
        );
        return;
      }

      if (item.bulkQuantity > 0) {
        apiItems.push({
          productId: item.productId,
          quantity: item.bulkQuantity,
          unitType: "BULK",
        });
      }
      if (item.pieceQuantity > 0) {
        apiItems.push({
          productId: item.productId,
          quantity: item.pieceQuantity,
          unitType: "PIECE",
        });
      }
    }

    if (apiItems.length === 0) {
      setErrorMessage("Please enter quantities to transfer.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationBranchId,
          reason: reason.trim() || undefined,
          notes: notes.trim() || undefined,
          items: apiItems,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete transfer.");
      }

      setSuccessDetails({ referenceNumber: data.referenceNumber });

      // Immediate local state update: prepend newly created transfer to table
      if (data.transfer) {
        setTransfers((prev) => [data.transfer, ...prev.filter((t) => t.id !== data.transfer.id)]);
      }

      // Decrement transferred stock from local productsList
      setProductsList((prev) =>
        prev.map((p) => {
          const item = transferItems.find((i) => i.productId === p.id);
          if (!item) return p;
          const mult = p.piecesPerBulk || 1;
          const piecesMoved = item.bulkQuantity * mult + item.pieceQuantity;
          return {
            ...p,
            currentStock: Math.max(0, p.currentStock - piecesMoved),
          };
        })
      );

      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setDestinationBranchId("");
    setReason("");
    setNotes("");
    setTransferItems([]);
    setErrorMessage(null);
    setSuccessDetails(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <ArrowLeftRight className="w-6 h-6 text-brand-400" />
              Direct Inter-Branch Transfers
            </h1>
            <Badge variant="outline" className="border-brand-500/30 text-brand-400">
              Component 20
            </Badge>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            Authoritative, instant inventory reallocation between{" "}
            <span className="text-surface-200 font-semibold">{currentBranchName}</span> and other branches with zero shrinkage.
          </p>
        </div>

        <Button
          onClick={() => {
            resetModal();
            setIsModalOpen(true);
          }}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium flex items-center gap-2 shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Initiate Stock Transfer
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-surface-400 tracking-wider">
              Total Transfers
            </span>
            <ArrowLeftRight className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalTransfers}</p>
          <p className="text-xs text-surface-500 mt-1">All recorded direct transfers</p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-warning-400 tracking-wider">
              Outgoing Transfers
            </span>
            <ArrowUpRight className="w-4 h-4 text-warning-400" />
          </div>
          <p className="text-2xl font-bold text-warning-400 mt-2">{outgoingCount}</p>
          <p className="text-xs text-surface-500 mt-1">Dispatched from {currentBranchCode}</p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-success-400 tracking-wider">
              Incoming Transfers
            </span>
            <ArrowDownLeft className="w-4 h-4 text-success-400" />
          </div>
          <p className="text-2xl font-bold text-success-400 mt-2">{incomingCount}</p>
          <p className="text-xs text-surface-500 mt-1">Received into {currentBranchCode}</p>
        </Card>

        <Card className="p-4 bg-surface-900/60 border-surface-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-brand-400 tracking-wider">
              Units Reallocated
            </span>
            <Package className="w-4 h-4 text-brand-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{totalUnitsMoved.toLocaleString()}</p>
          <p className="text-xs text-surface-500 mt-1">Total items moved across branches</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-surface-900/60 border-surface-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, branch, product..."
              className="w-full pl-9 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setDirectionFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === "ALL"
                  ? "bg-brand-500/20 text-brand-400 border border-brand-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              All Direct Transfers
            </button>
            <button
              onClick={() => setDirectionFilter("OUTGOING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === "OUTGOING"
                  ? "bg-warning-500/20 text-warning-400 border border-warning-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              Outgoing (Out)
            </button>
            <button
              onClick={() => setDirectionFilter("INCOMING")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                directionFilter === "INCOMING"
                  ? "bg-success-500/20 text-success-400 border border-success-500/30"
                  : "bg-surface-800 text-surface-400 hover:text-white"
              }`}
            >
              Incoming (In)
            </button>
          </div>
        </div>

        {/* Delicate Time Window Switcher (Defaults strictly to 24 Hours) & Owner Branch Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-surface-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[11px] text-surface-400 flex items-center gap-1 mr-1 shrink-0 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Window:
            </span>
            {[
              { id: "24h", label: "Last 24 Hours" },
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
              { id: "all", label: "All Time" },
            ].map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleWindowChange(w.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeWindow === w.id
                    ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                    : "bg-surface-800 text-surface-300 hover:text-white"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Owner Branch Location Switcher Pills (Defaults strictly to Active Branch) */}
          {isOwner && branches.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-[11px] text-surface-400 flex items-center gap-1 mr-1 shrink-0 font-medium">
                <Building2 className="w-3.5 h-3.5 text-brand-400" />
                Branch:
              </span>
              <button
                type="button"
                onClick={() => handleBranchChange(currentBranchId)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedBranchId === currentBranchId || (!selectedBranchId && currentBranchId)
                    ? "bg-brand-500 text-white shadow-xs font-bold"
                    : "bg-surface-800 text-surface-300 hover:text-white"
                }`}
              >
                {currentBranchName} ({currentBranchCode})
              </button>
              {branches
                .filter((b) => b.id !== currentBranchId)
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleBranchChange(b.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedBranchId === b.id
                        ? "bg-brand-500 text-white shadow-xs font-bold"
                        : "bg-surface-800 text-surface-300 hover:text-white"
                    }`}
                  >
                    {b.name} ({b.code})
                  </button>
                ))}
              <button
                type="button"
                onClick={() => handleBranchChange("ALL")}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedBranchId === "ALL"
                    ? "bg-brand-500 text-white shadow-xs font-bold"
                    : "bg-surface-800 text-surface-300 hover:text-white"
                }`}
              >
                All Branches
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Transfers Ledger Table */}
      <Card className="bg-surface-900/60 border-surface-800 overflow-hidden">
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-surface-400" />
            <h2 className="text-sm font-semibold uppercase text-surface-300 tracking-wider">
              Transfer Activity Log ({filteredTransfers.length})
            </h2>
          </div>
        </div>

        {filteredTransfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowLeftRight className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-300">No stock transfers found</p>
            <p className="text-xs text-surface-500 mt-1">
              Initiate a stock transfer to instantly balance inventory across branch locations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-950/60 text-surface-400 border-b border-surface-800 text-xs uppercase font-medium">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Flow Direction</th>
                  <th className="px-4 py-3">From Branch</th>
                  <th className="px-4 py-3">To Branch</th>
                  <th className="px-4 py-3">Products Moved</th>
                  <th className="px-4 py-3">Initiated By</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {filteredTransfers.map((t) => {
                  const isOutgoing = t.sourceBranchId === currentBranchId;
                  const totalItems = t.items.reduce((acc, i) => acc + i.quantity, 0);

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-surface-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedTransfer(t)}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-brand-400">
                        {t.referenceNumber}
                      </td>
                      <td className="px-4 py-3">
                        {isOutgoing ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-warning-500/10 text-warning-400 border border-warning-500/20">
                            <ArrowUpRight className="w-3 h-3" />
                            OUTGOING
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-success-500/10 text-success-400 border border-success-500/20">
                            <ArrowDownLeft className="w-3 h-3" />
                            INCOMING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-surface-200">
                        <div className="font-medium">{t.sourceBranchName}</div>
                        <div className="text-xs text-surface-500 font-mono">{t.sourceBranchCode}</div>
                      </td>
                      <td className="px-4 py-3 text-surface-200">
                        <div className="font-medium">{t.destinationBranchName}</div>
                        <div className="text-xs text-surface-500 font-mono">{t.destinationBranchCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">
                          {t.items.length} product line{t.items.length === 1 ? "" : "s"}
                        </div>
                        <div className="text-xs text-surface-400 truncate max-w-xs" title={formatTransferItemSummary(t.items)}>
                          {formatTransferItemSummary(t.items)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-surface-500" />
                          <span>{t.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-surface-400 whitespace-nowrap">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTransfer(t);
                          }}
                          className="text-xs text-brand-400 hover:text-brand-300"
                        >
                          View Items
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Initiation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="bg-surface-900 border-surface-700 w-full max-w-2xl my-8 overflow-hidden shadow-2xl">
            {successDetails ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-success-500/20 text-success-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white">Stock Transfer Completed</h3>
                <p className="text-sm text-surface-300">
                  Inventory reallocated atomically. Reference ID:
                </p>
                <div className="p-3 bg-surface-950 border border-surface-800 rounded-lg font-mono text-brand-400 font-bold text-base">
                  {successDetails.referenceNumber}
                </div>
                <p className="text-xs text-surface-500">
                  Stock deducted from {currentBranchName} and added to destination branch in real-time.
                </p>
                <div className="pt-4">
                  <Button
                    onClick={resetModal}
                    className="bg-brand-500 hover:bg-brand-600 text-white w-full"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitTransfer}>
                <div className="p-4 sm:p-6 border-b border-surface-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-brand-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">Initiate Direct Stock Transfer</h3>
                      <p className="text-xs text-surface-400">
                        Dispatched from: <span className="text-white font-medium">{currentBranchName}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetModal}
                    className="text-surface-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  {errorMessage && (
                    <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Destination Branch Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                      Destination Branch *
                    </label>
                    <select
                      value={destinationBranchId}
                      onChange={(e) => setDestinationBranchId(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                      required
                    >
                      <option value="">Select receiving branch...</option>
                      {destinationBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Reason & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                        Transfer Reason
                      </label>
                      <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Branch stock replenishment"
                        className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                        Internal Notes
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Dispatched via van driver"
                        className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  {/* Product Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-surface-300 uppercase tracking-wider mb-1.5">
                      Add Product Line Item
                    </label>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) => {
                          handleAddItem(e.target.value);
                          e.target.value = "";
                        }}
                        defaultValue=""
                        className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                      >
                        <option value="" disabled>
                          Select product to add...
                        </option>
                        {productsList
                          .filter((p) => p.currentStock > 0 && !transferItems.some((i) => i.productId === p.id))
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) | Available: {formatStockDisplay(p.currentStock, p.bulkUnit, p.pieceUnit, p.piecesPerBulk)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Selected Items List */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                      Selected Items ({transferItems.length})
                    </span>

                    {transferItems.length === 0 ? (
                      <div className="p-4 text-center border border-dashed border-surface-800 rounded-lg text-xs text-surface-500">
                        No products added to this transfer yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {transferItems.map((item) => {
                          const prod = productsList.find((p) => p.id === item.productId);
                          if (!prod) return null;

                          const hasMultiUnit = (prod.piecesPerBulk || 1) > 1;
                          const bulkUnit = prod.bulkUnit || prod.inventoryUnit || "CRATE";
                          const pieceUnit = prod.pieceUnit || "PIECE";
                          const piecesMultiplier = prod.piecesPerBulk || 1;
                          const totalPieces = item.bulkQuantity * piecesMultiplier + item.pieceQuantity;
                          const isOver = totalPieces > prod.currentStock;
                          const isZero = totalPieces <= 0;

                          return (
                            <div
                              key={item.productId}
                              className={`p-3.5 rounded-lg border flex flex-col gap-2.5 transition-all ${
                                isOver
                                  ? "bg-danger-500/10 border-danger-500/30"
                                  : isZero
                                  ? "bg-warning-500/10 border-warning-500/30"
                                  : "bg-surface-800/80 border-surface-700"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-white truncate">
                                    {prod.name}
                                  </div>
                                  <div className="text-xs text-surface-400 mt-0.5">
                                    Available:{" "}
                                    <span className="text-white font-medium">
                                      {formatStockDisplay(prod.currentStock, bulkUnit, pieceUnit, prod.piecesPerBulk || 1)}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.productId)}
                                  className="text-surface-400 hover:text-danger-400 p-1 rounded hover:bg-surface-700/50 transition-colors"
                                  title="Remove item"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-700/60">
                                {hasMultiUnit ? (
                                  <div className="grid grid-cols-2 gap-2.5 flex-1 max-w-sm">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">
                                        Bulk ({bulkUnit}s)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={item.bulkQuantity}
                                        onChange={(e) =>
                                          handleUpdateBulkQty(item.productId, parseInt(e.target.value) || 0)
                                        }
                                        className="w-full px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-md text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">
                                        Loose ({pieceUnit}s)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={item.pieceQuantity}
                                        onChange={(e) =>
                                          handleUpdatePieceQty(item.productId, parseInt(e.target.value) || 0)
                                        }
                                        className="w-full px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-md text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-40">
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-1">
                                      Quantity ({bulkUnit}s)
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.bulkQuantity}
                                      onChange={(e) =>
                                        handleUpdateBulkQty(item.productId, parseInt(e.target.value) || 0)
                                      }
                                      className="w-full px-2.5 py-1.5 bg-surface-900 border border-surface-700 rounded-md text-sm font-mono text-white focus:outline-none focus:border-brand-500"
                                    />
                                  </div>
                                )}

                                <div className="text-right sm:pl-4">
                                  {hasMultiUnit ? (
                                    <div className="text-xs font-mono">
                                      <div className="text-brand-300 font-semibold">
                                        {item.bulkQuantity > 0 ? `${item.bulkQuantity} ${bulkUnit}${item.bulkQuantity === 1 ? "" : "s"}` : ""}
                                        {item.bulkQuantity > 0 && item.pieceQuantity > 0 ? " + " : ""}
                                        {item.pieceQuantity > 0 ? `${item.pieceQuantity} ${pieceUnit}${item.pieceQuantity === 1 ? "" : "s"}` : ""}
                                        {item.bulkQuantity === 0 && item.pieceQuantity === 0 ? "0 units" : ""}
                                      </div>
                                      <div className="text-[10px] text-surface-400 mt-0.5">
                                        = {totalPieces} total {pieceUnit}s
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs font-mono text-brand-300 font-semibold">
                                      {item.bulkQuantity} {bulkUnit}{item.bulkQuantity === 1 ? "" : "s"}
                                    </div>
                                  )}

                                  {isOver && (
                                    <div className="text-[10px] text-danger-400 font-medium mt-1">
                                      Exceeds available ({prod.currentStock} max)
                                    </div>
                                  )}
                                  {isZero && (
                                    <div className="text-[10px] text-warning-400 font-medium mt-1">
                                      Specify quantity
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-surface-800 bg-surface-950 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={resetModal}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || transferItems.length === 0}
                    className="bg-brand-500 hover:bg-brand-600 text-white min-w-32"
                  >
                    {isSubmitting ? "Processing..." : "Confirm & Transfer"}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}

      {/* Transfer Item Detail Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-surface-900 border-surface-700 w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-surface-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-400" />
                <h3 className="text-base font-bold text-white font-mono">
                  {selectedTransfer.referenceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTransfer(null)}
                className="text-surface-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs bg-surface-950 p-3 rounded-lg border border-surface-800">
                <div>
                  <span className="text-surface-500">From:</span>{" "}
                  <span className="text-white font-medium">{selectedTransfer.sourceBranchName}</span>
                </div>
                <div>
                  <span className="text-surface-500">To:</span>{" "}
                  <span className="text-white font-medium">{selectedTransfer.destinationBranchName}</span>
                </div>
                <div>
                  <span className="text-surface-500">Dispatcher:</span>{" "}
                  <span className="text-white">{selectedTransfer.employeeName}</span>
                </div>
                <div>
                  <span className="text-surface-500">Timestamp:</span>{" "}
                  <span className="text-surface-300">{formatDateTime(selectedTransfer.createdAt)}</span>
                </div>
                {selectedTransfer.reason && (
                  <div className="col-span-2">
                    <span className="text-surface-500">Reason:</span>{" "}
                    <span className="text-surface-300">{selectedTransfer.reason}</span>
                  </div>
                )}
                {selectedTransfer.notes && (
                  <div className="col-span-2">
                    <span className="text-surface-500">Notes:</span>{" "}
                    <span className="text-surface-300">{selectedTransfer.notes}</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase text-surface-400 tracking-wider mb-2">
                  Line Items ({selectedTransfer.items.length})
                </h4>
                <div className="divide-y divide-surface-800 border border-surface-800 rounded-lg overflow-hidden">
                  {selectedTransfer.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-950/40 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-medium text-white">{item.productName}</div>
                        <div className="text-surface-500 font-mono">{item.productSku}</div>
                      </div>
                      <div className="font-mono font-bold text-brand-400 text-sm">
                        {item.quantity} {item.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-surface-800 bg-surface-950 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTransfer(null)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
