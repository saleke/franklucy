"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  Building2,
  User,
  ArrowRight,
  CheckCircle2,
  Printer,
  ShoppingBag,
  AlertCircle,
  CreditCard,
  Receipt,
  LogOut,
  X,
  ArrowDownRight,
  Sparkles,
  Keyboard,
  ShieldAlert,
  Layers,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface POSProduct {
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
}

export interface POSCustomer {
  id: string;
  name: string;
  phone: string | null;
  creditLimit: number;
  outstandingBalance?: number;
}

export interface CashSessionInfo {
  id: string;
  referenceNumber: string;
  branchId: string;
  cashierId: string;
  status: "OPEN";
  openingCash: string;
  openedAt: Date | string;
}

interface POSWorkspaceProps {
  branchId: string;
  branchName: string;
  branchCode: string;
  cashierName: string;
  userRole?: string;
  initialProducts: POSProduct[];
  customers: POSCustomer[];
  initialCashSession?: CashSessionInfo | null;
}

export interface CartItem {
  cartItemId: string; // `${productId}_${unitType}`
  productId: string;
  name: string;
  unitType: "BULK" | "PIECE";
  unitName: string;
  unitPrice: number;
  quantity: number;
  piecesMultiplier: number;
}

export function formatStockDisplay(
  currentStockPieces: number,
  bulkUnit: string,
  pieceUnit: string,
  piecesPerBulk: number
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

export const POSWorkspace: React.FC<POSWorkspaceProps> = ({
  branchId,
  branchName,
  branchCode,
  cashierName,
  userRole = "CASHIER",
  initialProducts,
  customers,
  initialCashSession = null,
}) => {
  const router = useRouter();

  // State
  const [products] = useState<POSProduct[]>(initialProducts);
  const [cashSession, setCashSession] = useState<CashSessionInfo | null>(
    initialCashSession
  );
  const [openSessionModalOpen, setOpenSessionModalOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState("0");
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  // Close session state
  const [closeSessionModalOpen, setCloseSessionModalOpen] = useState(false);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  const [declaredCashInput, setDeclaredCashInput] = useState("");
  const [declaredTransferInput, setDeclaredTransferInput] = useState("");
  const [closingNotesInput, setClosingNotesInput] = useState("");
  const [closeSessionError, setCloseSessionError] = useState<string | null>(null);

  const fetchSessionSummaryAndOpenModal = async () => {
    if (!cashSession) return;
    setIsLoadingSummary(true);
    setCloseSessionError(null);
    setCloseSessionModalOpen(true);
    try {
      const res = await fetch(`/api/cash-session/summary?sessionId=${cashSession.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load session summary");
      setSessionSummary(data.summary);
      setDeclaredCashInput(data.summary.expectedCash || "0");
      setDeclaredTransferInput(data.summary.expectedTransfer || "0");
      setClosingNotesInput("");
    } catch (err: any) {
      setCloseSessionError(err.message || "Failed to load drawer summary.");
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleCloseCashSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashSession) return;
    setIsClosingSession(true);
    setCloseSessionError(null);

    try {
      const res = await fetch("/api/cash-session/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: cashSession.id,
          declaredCash: declaredCashInput.trim() || "0",
          declaredTransfer: declaredTransferInput.trim() || "0",
          notes: closingNotesInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to close cash drawer session.");
      }

      setCashSession(null);
      setCloseSessionModalOpen(false);
      setSessionSummary(null);
      router.refresh();
    } catch (err: any) {
      setCloseSessionError(err.message || "Failed to close cash drawer session.");
    } finally {
      setIsClosingSession(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [stockAvailabilityFilter, setStockAvailabilityFilter] = useState<"ALL" | "IN_STOCK" | "LOW_STOCK">("ALL");
  const [visibleProductCount, setVisibleProductCount] = useState<number>(24);
  const [customersList, setCustomersList] = useState<POSCustomer[]>(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settlementMode, setSettlementMode] = useState<"FULL" | "PARTIAL" | "CREDIT">("FULL");
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "BANK_TRANSFER" | "OTHER"
  >("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [partialAmountPaid, setPartialAmountPaid] = useState<string>("");
  const [settlementDueDate, setSettlementDueDate] = useState<string>("");
  const [settlementNotes, setSettlementNotes] = useState<string>("");
  const [transferRef, setTransferRef] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick Customer Creation modal
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickCreditLimit, setQuickCreditLimit] = useState("0");
  const [isQuickCreating, setIsQuickCreating] = useState(false);
  const [quickCreateError, setQuickCreateError] = useState<string | null>(null);

  // Custom Quantity & Unit Selection modal
  const [unitModalProduct, setUnitModalProduct] = useState<POSProduct | null>(null);
  const [unitModalType, setUnitModalType] = useState<"BULK" | "PIECE">("BULK");
  const [unitModalQty, setUnitModalQty] = useState<number>(1);

  // Success modal state
  const [completedSale, setCompletedSale] = useState<{
    saleId: string;
    invoiceNumber: string;
    total: string;
    amountPaid?: string;
    unpaidBalance?: string;
    paymentStatus?: "COMPLETED" | "PARTIAL" | "CREDIT";
    changeDue?: string;
  } | null>(null);

  const handleOpenCashSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpeningSession(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/cash-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          openingCash: openingCashInput.trim() || "0",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to open cash drawer session.");
      }

      setCashSession(data.session);
      setOpenSessionModalOpen(false);
      setOpeningCashInput("0");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to open cash session.");
    } finally {
      setIsOpeningSession(false);
    }
  };

  // Drawer Cash Drop / Payout state
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutCategory, setPayoutCategory] = useState<
    "FUEL" | "LOGISTICS" | "SUPPLIES" | "CASH_DROP" | "OWNER_WITHDRAWAL" | "OTHER"
  >("FUEL");
  const [payoutRecipient, setPayoutRecipient] = useState("");
  const [payoutReason, setPayoutReason] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState<string | null>(null);

  // Barcode scanner ref and feedback
  const searchRef = useRef<HTMLInputElement>(null);
  const [barcodeFeedback, setBarcodeFeedback] = useState<string | null>(null);

  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashSession) return;
    setIsSubmittingPayout(true);
    setPayoutError(null);

    try {
      const res = await fetch("/api/cash-session/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: cashSession.id,
          amount: payoutAmount.trim(),
          category: payoutCategory,
          recipient: payoutRecipient.trim() || undefined,
          reason: payoutReason.trim(),
          reference: payoutReference.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record cash payout.");
      }

      setPayoutSuccessMsg(
        `✓ Payout of ${formatNaira(Number(payoutAmount))} recorded for [${payoutCategory}].`
      );
      setTimeout(() => {
        setPayoutSuccessMsg(null);
        setPayoutModalOpen(false);
        setPayoutAmount("");
        setPayoutReason("");
        setPayoutRecipient("");
        setPayoutReference("");
      }, 1500);

      router.refresh();
    } catch (err: any) {
      setPayoutError(err.message || "Failed to record cash payout.");
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [products]);

  const inStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock > 0).length;
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock > 0 && p.currentStock <= p.reorderLevel).length;
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategory === "ALL" || p.category === selectedCategory;

      if (!matchesSearch || !matchesCat) return false;

      if (stockAvailabilityFilter === "IN_STOCK" && p.currentStock <= 0) {
        return false;
      }
      if (stockAvailabilityFilter === "LOW_STOCK" && !(p.currentStock > 0 && p.currentStock <= p.reorderLevel)) {
        return false;
      }
      return true;
    });
  }, [products, searchQuery, selectedCategory, stockAvailabilityFilter]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductCount);
  }, [filteredProducts, visibleProductCount]);

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const discount = 0; // standard POS sale discount
  const grandTotal = subtotal - discount;

  // Change Calculation
  const changeDue = useMemo(() => {
    if (paymentMethod !== "CASH" || settlementMode !== "FULL") return 0;
    const received = Number(cashReceived);
    if (isNaN(received) || received < grandTotal) return 0;
    return received - grandTotal;
  }, [paymentMethod, settlementMode, cashReceived, grandTotal]);

  // Selected customer & credit health calculations
  const selectedCustomer = useMemo(
    () => customersList.find((c) => c.id === selectedCustomerId) || null,
    [customersList, selectedCustomerId]
  );

  const customerCurrentDebt = selectedCustomer?.outstandingBalance || 0;
  const customerCreditLimit = selectedCustomer?.creditLimit || 0;

  const depositPaidNumber = useMemo(() => {
    if (settlementMode === "FULL") return grandTotal;
    if (settlementMode === "CREDIT") return 0;
    const num = Number(partialAmountPaid);
    return isNaN(num) ? 0 : num;
  }, [settlementMode, partialAmountPaid, grandTotal]);

  const unpaidDebtThisSale = useMemo(() => {
    if (settlementMode === "FULL") return 0;
    if (settlementMode === "CREDIT") return grandTotal;
    return Math.max(0, grandTotal - depositPaidNumber);
  }, [settlementMode, grandTotal, depositPaidNumber]);

  const projectedTotalDebt = useMemo(() => {
    return customerCurrentDebt + unpaidDebtThisSale;
  }, [customerCurrentDebt, unpaidDebtThisSale]);

  const isExceedingCreditLimit = useMemo(() => {
    return (
      (settlementMode === "PARTIAL" || settlementMode === "CREDIT") &&
      customerCreditLimit > 0 &&
      projectedTotalDebt > customerCreditLimit
    );
  }, [settlementMode, customerCreditLimit, projectedTotalDebt]);

  const overLimitAmount = useMemo(() => {
    return isExceedingCreditLimit ? projectedTotalDebt - customerCreditLimit : 0;
  }, [isExceedingCreditLimit, projectedTotalDebt, customerCreditLimit]);

  // Cart Management
  const addToCart = (
    prod: POSProduct,
    unitType: "BULK" | "PIECE" = "BULK",
    qtyToAdd: number = 1
  ) => {
    if (prod.currentStock <= 0 || qtyToAdd <= 0) return;
    setErrorMsg(null);

    const isPiece = unitType === "PIECE";
    const piecesMultiplier = isPiece ? 1 : (prod.piecesPerBulk || 1);
    const unitPrice = isPiece
      ? prod.piecePrice || Math.ceil(prod.sellingPrice / (prod.piecesPerBulk || 1))
      : prod.sellingPrice;
    const unitName = isPiece ? prod.pieceUnit : prod.bulkUnit;
    const cartItemId = `${prod.productId}_${unitType}`;

    setCart((prev) => {
      const currentPiecesInCart = prev
        .filter((i) => i.productId === prod.productId)
        .reduce((sum, i) => sum + i.quantity * i.piecesMultiplier, 0);

      const addedPieces = qtyToAdd * piecesMultiplier;
      if (currentPiecesInCart + addedPieces > prod.currentStock) {
        setErrorMsg(
          `Cannot add ${qtyToAdd} ${unitName}(s) of ${prod.name}: Reached available branch stock limit (${formatStockDisplay(
            prod.currentStock,
            prod.bulkUnit,
            prod.pieceUnit,
            prod.piecesPerBulk
          )}).`
        );
        return prev;
      }

      const existingIndex = prev.findIndex((item) => item.cartItemId === cartItemId);
      if (existingIndex >= 0) {
        return prev.map((item, idx) =>
          idx === existingIndex ? { ...item, quantity: item.quantity + qtyToAdd } : item
        );
      }

      return [
        ...prev,
        {
          cartItemId,
          productId: prod.productId,
          name: prod.name,
          unitType,
          unitName,
          unitPrice,
          quantity: qtyToAdd,
          piecesMultiplier,
        },
      ];
    });
  };

  const setDirectQuantity = (cartItemId: string, rawQty: number) => {
    setErrorMsg(null);
    const targetQty = Math.max(1, Math.floor(rawQty || 1));
    setCart((prev) => {
      const item = prev.find((i) => i.cartItemId === cartItemId);
      if (!item) return prev;
      const prod = products.find((p) => p.productId === item.productId);
      if (!prod) return prev;

      const otherItemsPieces = prev
        .filter((i) => i.productId === item.productId && i.cartItemId !== cartItemId)
        .reduce((sum, i) => sum + i.quantity * i.piecesMultiplier, 0);

      const requestedPieces = targetQty * item.piecesMultiplier;
      if (otherItemsPieces + requestedPieces > prod.currentStock) {
        setErrorMsg(
          `Cannot set quantity to ${targetQty}: Exceeds available branch stock (${formatStockDisplay(
            prod.currentStock,
            prod.bulkUnit,
            prod.pieceUnit,
            prod.piecesPerBulk
          )}).`
        );
        return prev;
      }

      return prev.map((i) =>
        i.cartItemId === cartItemId ? { ...i, quantity: targetQty } : i
      );
    });
  };

  const switchItemUnit = (cartItemId: string) => {
    setErrorMsg(null);
    setCart((prev) => {
      const item = prev.find((i) => i.cartItemId === cartItemId);
      if (!item) return prev;
      const prod = products.find((p) => p.productId === item.productId);
      if (!prod) return prev;

      const newUnit: "BULK" | "PIECE" = item.unitType === "BULK" ? "PIECE" : "BULK";
      const isPiece = newUnit === "PIECE";
      const newMultiplier = isPiece ? 1 : (prod.piecesPerBulk || 1);
      const newPrice = isPiece
        ? prod.piecePrice || Math.ceil(prod.sellingPrice / (prod.piecesPerBulk || 1))
        : prod.sellingPrice;
      const newUnitName = isPiece ? prod.pieceUnit : prod.bulkUnit;
      const newCartItemId = `${prod.productId}_${newUnit}`;

      let convertedQty = item.quantity;
      if (item.unitType === "BULK" && newUnit === "PIECE") {
        convertedQty = item.quantity * (prod.piecesPerBulk || 1);
      } else if (item.unitType === "PIECE" && newUnit === "BULK") {
        convertedQty = Math.max(1, Math.round(item.quantity / (prod.piecesPerBulk || 1)));
      }

      const otherItemsPieces = prev
        .filter(
          (i) =>
            i.productId === item.productId &&
            i.cartItemId !== cartItemId &&
            i.cartItemId !== newCartItemId
        )
        .reduce((sum, i) => sum + i.quantity * i.piecesMultiplier, 0);

      if (otherItemsPieces + convertedQty * newMultiplier > prod.currentStock) {
        convertedQty = Math.max(
          1,
          Math.floor((prod.currentStock - otherItemsPieces) / newMultiplier)
        );
      }

      const existingTarget = prev.find((i) => i.cartItemId === newCartItemId);
      if (existingTarget) {
        return prev
          .filter((i) => i.cartItemId !== cartItemId)
          .map((i) =>
            i.cartItemId === newCartItemId
              ? { ...i, quantity: i.quantity + convertedQty }
              : i
          );
      }

      return prev.map((i) =>
        i.cartItemId === cartItemId
          ? {
              ...i,
              cartItemId: newCartItemId,
              unitType: newUnit,
              unitName: newUnitName,
              unitPrice: newPrice,
              quantity: convertedQty,
              piecesMultiplier: newMultiplier,
            }
          : i
      );
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setErrorMsg(null);
    setCart((prev) => {
      const item = prev.find((i) => i.cartItemId === cartItemId);
      if (!item) return prev;

      const prod = products.find((p) => p.productId === item.productId);
      const nextQty = item.quantity + delta;

      if (nextQty <= 0) {
        return prev.filter((i) => i.cartItemId !== cartItemId);
      }

      if (delta > 0 && prod) {
        const currentPiecesInCart = prev
          .filter((i) => i.productId === item.productId)
          .reduce((sum, i) => sum + i.quantity * i.piecesMultiplier, 0);

        const addedPieces = delta * item.piecesMultiplier;
        if (currentPiecesInCart + addedPieces > prod.currentStock) {
          setErrorMsg(
            `Cannot add more: Branch has only ${formatStockDisplay(
              prod.currentStock,
              prod.bulkUnit,
              prod.pieceUnit,
              prod.piecesPerBulk
            )} available.`
          );
          return prev;
        }
      }

      return prev.map((i) =>
        i.cartItemId === cartItemId ? { ...i, quantity: nextQty } : i
      );
    });
  };

  const removeItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    setErrorMsg(null);
  };

  // Quick Create Customer Handler
  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickName.trim()) {
      setQuickCreateError("Customer name is required.");
      return;
    }
    setIsQuickCreating(true);
    setQuickCreateError(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickName.trim(),
          phone: quickPhone.trim() || undefined,
          address: quickAddress.trim() || undefined,
          creditLimit: Number(quickCreditLimit) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create customer.");
      }

      const newCustomer: POSCustomer = {
        id: data.id,
        name: data.name,
        phone: data.phone,
        creditLimit: Number(data.creditLimit || 0),
        outstandingBalance: 0,
      };

      setCustomersList((prev) => [newCustomer, ...prev]);
      setSelectedCustomerId(newCustomer.id);
      setQuickCustomerModalOpen(false);
      setQuickName("");
      setQuickPhone("");
      setQuickAddress("");
      setQuickCreditLimit("0");
    } catch (err: any) {
      setQuickCreateError(err.message || "Failed to create customer.");
    } finally {
      setIsQuickCreating(false);
    }
  };

  // Submit Sale Transaction
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setErrorMsg(null);

    // Validation for partial or credit mode
    if (settlementMode === "PARTIAL" || settlementMode === "CREDIT") {
      if (!selectedCustomerId) {
        setErrorMsg("A registered customer account is required for partial payments or store credit. Please select or add a customer.");
        return;
      }
    }

    if (settlementMode === "PARTIAL") {
      if (depositPaidNumber <= 0) {
        setErrorMsg("Please enter the amount the customer is paying today (or switch to 100% Store Credit).");
        return;
      }
      if (depositPaidNumber >= grandTotal) {
        setErrorMsg("In Partial Payment mode, amount paid must be less than the total. For full payment, please select 'Full Settlement'.");
        return;
      }
    }

    if (depositPaidNumber > 0 && paymentMethod === "CASH") {
      if (!cashSession && userRole !== "OWNER") {
        setOpenSessionModalOpen(true);
        setErrorMsg("An active cash drawer session is required to accept cash sales. Please declare opening cash.");
        return;
      }
      if (settlementMode === "FULL") {
        const received = Number(cashReceived || grandTotal);
        if (received < grandTotal) {
          setErrorMsg("Cash received cannot be less than the total amount due.");
          return;
        }
      }
    }

    if (depositPaidNumber > 0 && paymentMethod === "BANK_TRANSFER" && !transferRef.trim()) {
      setErrorMsg("Please enter the bank transfer transaction reference for the deposit.");
      return;
    }

    setIsSubmitting(true);

    try {
      const idempotencyKey = crypto.randomUUID();

      let paymentAmountToSend = "0";
      if (settlementMode === "FULL") {
        paymentAmountToSend = (paymentMethod === "CASH" ? Number(cashReceived || grandTotal) : grandTotal).toString();
      } else if (settlementMode === "PARTIAL") {
        paymentAmountToSend = depositPaidNumber.toString();
      } else {
        paymentAmountToSend = "0";
      }

      const payload = {
        customerId: selectedCustomerId || null,
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitType: i.unitType,
        })),
        payment: {
          method: paymentMethod,
          amount: paymentAmountToSend,
          reference: transferRef.trim() || undefined,
          settlementType: settlementMode,
          dueDate: settlementDueDate || undefined,
          notes: settlementNotes.trim() || undefined,
        },
      };

      const res = await fetch("/api/sales/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "CASH_SESSION_REQUIRED") {
          setOpenSessionModalOpen(true);
        }
        setErrorMsg(data.error || "Failed to complete sale transaction.");
        setIsSubmitting(false);
        return;
      }

      setCompletedSale(data);
    } catch {
      setErrorMsg("Network error occurred while submitting transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startNewSale = () => {
    setCompletedSale(null);
    setCart([]);
    setCashReceived("");
    setPartialAmountPaid("");
    setSettlementDueDate("");
    setSettlementNotes("");
    setSettlementMode("FULL");
    setTransferRef("");
    setSelectedCustomerId("");
    setErrorMsg(null);
    router.refresh();
  };

  // Barcode scanner Enter handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = searchQuery.trim().toLowerCase();
      if (!query) return;

      // 1. Exact match on SKU or exact name
      const exactMatch = products.find(
        (p) => p.sku.toLowerCase() === query || p.name.toLowerCase() === query
      );

      // 2. Or if filteredProducts has exactly 1 result
      const target = exactMatch || (filteredProducts.length === 1 ? filteredProducts[0] : null);

      if (target) {
        if (target.currentStock <= 0) {
          setErrorMsg(`Cannot add ${target.name}: Out of stock in branch inventory.`);
        } else {
          addToCart(target);
          setSearchQuery("");
          setBarcodeFeedback(`✓ Added 1x ${target.name}`);
          setTimeout(() => setBarcodeFeedback(null), 2200);
        }
      } else if (filteredProducts.length === 0) {
        setErrorMsg(`No product found matching SKU or barcode "${searchQuery}".`);
      }
    }
  };

  // Keyboard Ergonomics
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName?.toLowerCase();
      const isInputActive = tag === "input" || tag === "textarea" || tag === "select";

      // F2: Focus Search / Scan Barcode
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // '/' to focus search if outside any input
      if (e.key === "/" && !isInputActive) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Ctrl+Enter or Cmd+Enter: Checkout
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (cart.length > 0 && !isSubmitting) {
          handleCompleteSale();
        }
        return;
      }

      // Esc: Close open modals or clear search
      if (e.key === "Escape") {
        if (unitModalProduct) setUnitModalProduct(null);
        else if (openSessionModalOpen) setOpenSessionModalOpen(false);
        else if (closeSessionModalOpen) setCloseSessionModalOpen(false);
        else if (payoutModalOpen) setPayoutModalOpen(false);
        else if (quickCustomerModalOpen) setQuickCustomerModalOpen(false);
        else if (completedSale) setCompletedSale(null);
        else if (searchQuery) setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cart.length,
    isSubmitting,
    unitModalProduct,
    openSessionModalOpen,
    closeSessionModalOpen,
    payoutModalOpen,
    quickCustomerModalOpen,
    completedSale,
    searchQuery,
  ]);

  return (
    <div className="space-y-4">
      {/* POS Topbar Context */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Link
            href="/sales"
            className="p-1.5 rounded-subtle hover:bg-surface-elevated text-text-secondary hover:text-text-primary text-xs"
          >
            ← Sales Register
          </Link>
          <span className="text-text-muted">/</span>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand" />
            <span>Point of Sale Workspace</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5 font-medium text-text-secondary">
            <Building2 className="w-3.5 h-3.5 text-brand" />
            {branchName} ({branchCode})
          </span>
          <span>·</span>
          <span>Cashier: {cashierName}</span>
          <span>·</span>
          {cashSession ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {cashSession.referenceNumber} (Float: {formatNaira(cashSession.openingCash)})
              </span>
              <button
                type="button"
                onClick={() => {
                  setPayoutError(null);
                  setPayoutSuccessMsg(null);
                  setPayoutModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-subtle bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                title="Record Cash Drop or Petty Cash Payout from drawer"
              >
                <ArrowDownRight className="w-3 h-3 text-amber-400" />
                <span>Cash Drop / Payout</span>
              </button>
              <button
                type="button"
                onClick={fetchSessionSummaryAndOpenModal}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-subtle bg-surface-elevated hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border text-[11px] font-medium transition-colors"
                title="Count drawer cash and reconcile shift"
              >
                <LogOut className="w-3 h-3 text-status-warning" />
                <span>Close Drawer</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpenSessionModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-subtle bg-status-warning-subtle text-status-warning border border-status-warning/30 hover:bg-status-warning/20 font-semibold transition-colors text-[11px]"
            >
              <DollarSign className="w-3 h-3" />
              <span>Open Cash Drawer</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selection (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Customer Selection Card */}
          <Card className="p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand" />
                <span>Customer Selection:</span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="h-8 flex-1 px-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Walk-in Customer (Default Cash)</option>
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""} {c.outstandingBalance && c.outstandingBalance > 0 ? `• [Debt: ${formatNaira(c.outstandingBalance)}]` : ""}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickCustomerModalOpen(true)}
                  className="h-8 px-2.5 text-xs gap-1 border-brand/40 text-brand hover:bg-brand/10 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </Button>
              </div>

              {/* Selected Customer Credit & Debt Indicator */}
              {selectedCustomer && (
                <div className="mt-2 p-2 rounded-subtle bg-surface-elevated/40 border border-border/80 text-[11px] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-brand" />
                    <span className="font-semibold text-text-primary">{selectedCustomer.name}</span>
                    {selectedCustomer.phone && (
                      <span className="font-mono text-text-muted">({selectedCustomer.phone})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span>
                      Current Debt:{" "}
                      <span className={customerCurrentDebt > 0 ? "text-status-danger font-bold" : "text-status-success font-semibold"}>
                        {formatNaira(customerCurrentDebt)}
                      </span>
                    </span>
                    {customerCreditLimit > 0 && (
                      <span className="text-text-muted">
                        Limit: <span className="text-text-primary">{formatNaira(customerCreditLimit)}</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Product Search & Filter Bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-2.5 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan barcode or type SKU / product name... (Press Enter to add, F2 to focus)"
                  className="w-full h-9 pl-9 pr-20 rounded-subtle border border-border bg-surface text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-1 focus:ring-brand font-sans"
                />
                <div className="absolute right-2.5 top-2 flex items-center gap-1">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-text-muted hover:text-text-primary p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface-elevated border border-border rounded">
                      F2
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Barcode Scanned Feedback Flash */}
            {barcodeFeedback && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-subtle bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-fadeIn">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{barcodeFeedback}</span>
              </div>
            )}

            {/* Cashier Keyboard Ergonomics Guide */}
            <div className="flex items-center justify-between text-[10px] text-text-muted px-1">
              <div className="flex items-center gap-1.5">
                <Keyboard className="w-3 h-3 text-brand" />
                <span>Press <kbd className="px-1 py-0.2 rounded bg-surface-elevated border border-border font-mono text-[9px]">Enter</kbd> on SKU to auto-add</span>
              </div>
              <div className="flex items-center gap-2">
                <span><kbd className="px-1 py-0.2 rounded bg-surface-elevated border border-border font-mono text-[9px]">Ctrl+Enter</kbd> Complete Sale</span>
                <span><kbd className="px-1 py-0.2 rounded bg-surface-elevated border border-border font-mono text-[9px]">Esc</kbd> Close</span>
              </div>
            </div>

            {/* Stock Availability & Category Filter Toolbar */}
            <div className="space-y-1.5">
              {/* Availability Filter Row */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStockAvailabilityFilter("ALL");
                    setVisibleProductCount(24);
                  }}
                  className={`px-2.5 py-1 rounded-subtle text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    stockAvailabilityFilter === "ALL"
                      ? "bg-brand text-white shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                  }`}
                >
                  All Catalog ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockAvailabilityFilter("IN_STOCK");
                    setVisibleProductCount(24);
                  }}
                  className={`px-2.5 py-1 rounded-subtle text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    stockAvailabilityFilter === "IN_STOCK"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-emerald-400"
                  }`}
                >
                  In Stock Only ({inStockCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStockAvailabilityFilter("LOW_STOCK");
                    setVisibleProductCount(24);
                  }}
                  className={`px-2.5 py-1 rounded-subtle text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    stockAvailabilityFilter === "LOW_STOCK"
                      ? "bg-amber-500 text-slate-950 font-bold shadow-xs"
                      : "bg-surface border border-border text-text-secondary hover:text-amber-400"
                  }`}
                >
                  Low Stock ({lowStockCount})
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {categories.map((cat) => {
                  const countInCat = cat === "ALL"
                    ? products.length
                    : products.filter((p) => p.category === cat).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        setVisibleProductCount(24);
                      }}
                      className={`px-2.5 py-0.5 rounded-subtle text-[10px] font-medium transition-colors whitespace-nowrap ${
                        selectedCategory === cat
                          ? "bg-surface-elevated text-amber-300 border border-amber-500/40"
                          : "bg-surface border border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {cat === "ALL" ? `All Categories (${countInCat})` : `${cat} (${countInCat})`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {displayedProducts.length === 0 ? (
              <div className="col-span-2 text-center py-12 border border-border border-dashed rounded-card text-text-muted text-xs">
                No matching active products found in branch inventory.
              </div>
            ) : (
              displayedProducts.map((p) => {
                const bulkCartItem = cart.find((i) => i.cartItemId === `${p.productId}_BULK`);
                const pieceCartItem = cart.find((i) => i.cartItemId === `${p.productId}_PIECE`);
                const bulkQtyInCart = bulkCartItem?.quantity || 0;
                const pieceQtyInCart = pieceCartItem?.quantity || 0;

                const totalPiecesInCart = (bulkQtyInCart * (p.piecesPerBulk || 1)) + pieceQtyInCart;
                const remainingStockPieces = Math.max(0, p.currentStock - totalPiecesInCart);

                const canAddBulk = remainingStockPieces >= (p.piecesPerBulk || 1);
                const canAddPiece = remainingStockPieces >= 1;
                const isOutOfStock = p.currentStock <= 0;
                const isLowStock = p.currentStock <= p.reorderLevel;

                const hasMultiUnit = (p.piecesPerBulk || 1) > 1;
                const effectivePiecePrice =
                  p.piecePrice || Math.ceil(p.sellingPrice / (p.piecesPerBulk || 1));

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-card border transition-all text-left flex flex-col justify-between select-none ${
                      isOutOfStock
                        ? "opacity-50 border-border bg-surface/50"
                        : "border-border bg-surface hover:border-brand/40 hover:bg-surface-elevated/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-text-primary leading-snug">
                          {p.name}
                        </h4>
                        <span className="font-mono text-[10px] text-text-muted shrink-0">
                          {p.sku}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {hasMultiUnit && (
                          <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded bg-surface-elevated border border-border/80 text-text-secondary font-medium">
                            1 {p.bulkUnit} = {p.piecesPerBulk} {p.pieceUnit}s
                          </span>
                        )}
                        <div className="text-[10px]">
                          {isOutOfStock ? (
                            <span className="text-status-danger font-semibold">Out of Stock</span>
                          ) : isLowStock ? (
                            <span className="text-status-warning font-semibold">
                              Low: {formatStockDisplay(p.currentStock, p.bulkUnit, p.pieceUnit, p.piecesPerBulk)}
                            </span>
                          ) : (
                            <span className="text-status-success font-medium">
                              {formatStockDisplay(p.currentStock, p.bulkUnit, p.pieceUnit, p.piecesPerBulk)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/60 space-y-1.5">
                      {hasMultiUnit ? (
                        /* Dual Quick-Buttons for Instant Bulk or Piece Selling */
                        <div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {/* Bulk Unit Button */}
                            <button
                              type="button"
                              disabled={!canAddBulk}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, "BULK", 1);
                              }}
                              className={`p-1.5 rounded-subtle text-left transition-all border flex flex-col justify-between ${
                                !canAddBulk
                                  ? "opacity-35 border-border bg-surface-elevated/20 cursor-not-allowed text-text-muted"
                                  : bulkQtyInCart > 0
                                  ? "bg-brand/15 border-brand/50 text-text-primary shadow-xs"
                                  : "bg-surface-elevated hover:bg-brand hover:text-white border-border text-text-primary group"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary group-hover:text-white">
                                  + 1 {p.bulkUnit}
                                </span>
                                {bulkQtyInCart > 0 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand text-white">
                                    {bulkQtyInCart}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold mt-1">
                                {formatNaira(p.sellingPrice)}
                              </span>
                            </button>

                            {/* Loose Piece Button */}
                            <button
                              type="button"
                              disabled={!canAddPiece}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, "PIECE", 1);
                              }}
                              className={`p-1.5 rounded-subtle text-left transition-all border flex flex-col justify-between ${
                                !canAddPiece
                                  ? "opacity-35 border-border bg-surface-elevated/20 cursor-not-allowed text-text-muted"
                                  : pieceQtyInCart > 0
                                  ? "bg-brand/15 border-brand/50 text-text-primary shadow-xs"
                                  : "bg-surface-elevated hover:bg-brand hover:text-white border-border text-text-primary group"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary group-hover:text-white">
                                  + 1 {p.pieceUnit}
                                </span>
                                {pieceQtyInCart > 0 && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-brand text-white">
                                    {pieceQtyInCart}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold mt-1">
                                {formatNaira(effectivePiecePrice)}
                              </span>
                            </button>
                          </div>

                          {/* Quick Custom Qty Modal Trigger */}
                          <button
                            type="button"
                            disabled={remainingStockPieces <= 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setUnitModalProduct(p);
                              setUnitModalType("BULK");
                              setUnitModalQty(1);
                            }}
                            className="w-full mt-1.5 py-1 px-2 rounded-subtle bg-surface-elevated/40 hover:bg-surface-elevated border border-border hover:border-brand/40 text-[10px] text-text-secondary hover:text-text-primary font-medium flex items-center justify-center gap-1 transition-colors"
                          >
                            <SlidersHorizontal className="w-3 h-3 text-brand" />
                            <span>Custom Quantity / Select Unit</span>
                          </button>
                        </div>
                      ) : (
                        /* Standard 1:1 products */
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="text-sm font-bold text-text-primary">
                            {formatNaira(p.sellingPrice)}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!canAddBulk}
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnitModalProduct(p);
                                setUnitModalType("BULK");
                                setUnitModalQty(1);
                              }}
                              className="h-7 px-2 rounded-subtle bg-surface-elevated/60 hover:bg-surface-elevated border border-border text-[11px] text-text-secondary hover:text-text-primary font-medium flex items-center gap-1 transition-colors"
                              title="Enter custom quantity"
                            >
                              <SlidersHorizontal className="w-3 h-3 text-brand" />
                              <span>Qty</span>
                            </button>
                            <button
                              type="button"
                              disabled={!canAddBulk}
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(p, "BULK", 1);
                              }}
                              className={`h-7 px-3 rounded-subtle text-xs font-medium flex items-center gap-1 transition-colors ${
                                !canAddBulk
                                  ? "opacity-40 bg-surface-elevated text-text-muted cursor-not-allowed border border-border"
                                  : bulkQtyInCart > 0
                                  ? "bg-brand text-white"
                                  : "bg-surface-elevated hover:bg-brand hover:text-white text-text-primary border border-border"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {bulkQtyInCart > 0 ? `${bulkQtyInCart} in cart` : "Add"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {filteredProducts.length > displayedProducts.length && (
              <div className="col-span-1 sm:col-span-2 py-2.5 px-3 rounded-card border border-dashed border-border bg-surface-elevated/20 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <span className="text-text-muted">
                  Showing {displayedProducts.length} of {filteredProducts.length} matching products
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisibleProductCount((prev) => prev + 24)}
                    className="px-3 py-1.5 rounded-subtle bg-surface-elevated hover:bg-brand hover:text-white border border-border text-text-primary font-semibold transition-all text-xs"
                  >
                    Show 24 More ({filteredProducts.length - displayedProducts.length} remaining)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibleProductCount(filteredProducts.length)}
                    className="px-2 py-1 text-brand hover:underline font-semibold text-xs"
                  >
                    Show All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Cart & Settlement (5 cols) */}
        <div id="pos-cart-panel" className="lg:col-span-5 space-y-4">
          <Card className="p-4 flex flex-col h-full border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand" />
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Current Sale Summary
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] text-text-muted hover:text-status-danger transition-colors"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mt-3 p-2.5 rounded-subtle bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Cart Line Items */}
            <div className="flex-1 my-3 space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-text-muted text-xs">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  Cart is empty. Select products from the inventory catalog on the left.
                </div>
              ) : (
                cart.map((item) => {
                  const product = products.find((p) => p.productId === item.productId);
                  const isMultiUnit = product && (product.piecesPerBulk || 1) > 1;

                  return (
                    <div
                      key={item.cartItemId}
                      className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-text-primary truncate max-w-[130px]">
                            {item.name}
                          </p>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                              item.unitType === "BULK"
                                ? "bg-brand/20 text-brand border border-brand/30"
                                : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            }`}
                          >
                            {item.unitName}
                          </span>
                          {isMultiUnit && (
                            <button
                              type="button"
                              onClick={() => switchItemUnit(item.cartItemId)}
                              title={`Switch unit to ${
                                item.unitType === "BULK" ? product.pieceUnit : product.bulkUnit
                              }`}
                              className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-surface hover:bg-brand/20 text-text-muted hover:text-brand border border-border hover:border-brand/40 transition-colors"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>⇄ {item.unitType === "BULK" ? product.pieceUnit : product.bulkUnit}</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                          {formatNaira(item.unitPrice)} / {item.unitName}
                        </p>
                      </div>

                      {/* Quantity Selector with Editable Input */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, -1)}
                          className="w-6 h-6 rounded-subtle bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            setDirectQuantity(item.cartItemId, parseInt(e.target.value) || 1)
                          }
                          className="w-12 h-6 text-center font-bold text-xs bg-surface border border-border rounded px-0.5 text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cartItemId, 1)}
                          className="w-6 h-6 rounded-subtle bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-right shrink-0 min-w-[70px]">
                        <div className="font-bold text-text-primary font-mono">
                          {formatNaira(item.unitPrice * item.quantity)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.cartItemId)}
                        className="text-text-muted hover:text-status-danger p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-3 border-t border-border space-y-1.5 text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} units):</span>
                <span>{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Authorized Discount:</span>
                <span>₦0</span>
              </div>
              <div className="flex justify-between text-base font-bold text-text-primary pt-2 border-t border-border">
                <span>Total Amount Due:</span>
                <span className="text-brand font-mono">
                  {formatNaira(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment Section */}
            {cart.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border space-y-3">
                {/* Settlement Mode Selector */}
                <div>
                  <div className="text-[11px] font-semibold uppercase text-text-muted tracking-wider mb-1.5">
                    Settlement Type:
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setSettlementMode("FULL")}
                      className={`py-1.5 px-2 rounded-subtle font-medium border text-center transition-colors text-[11px] ${
                        settlementMode === "FULL"
                          ? "bg-brand text-white border-brand shadow-sm font-bold"
                          : "bg-surface-elevated/30 border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      Full Settle
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementMode("PARTIAL")}
                      className={`py-1.5 px-2 rounded-subtle font-medium border text-center transition-colors text-[11px] ${
                        settlementMode === "PARTIAL"
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm font-bold"
                          : "bg-surface-elevated/30 border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      Partial / Deposit
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettlementMode("CREDIT")}
                      className={`py-1.5 px-2 rounded-subtle font-medium border text-center transition-colors text-[11px] ${
                        settlementMode === "CREDIT"
                          ? "bg-rose-500 text-white border-rose-500 shadow-sm font-bold"
                          : "bg-surface-elevated/30 border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      Store Credit
                    </button>
                  </div>
                </div>

                {/* Warning if credit/partial chosen without customer */}
                {(settlementMode === "PARTIAL" || settlementMode === "CREDIT") && !selectedCustomerId && (
                  <div className="p-2 rounded-subtle bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Customer Account Required</p>
                      <p className="text-[10px] text-amber-200/80">
                        Please select an existing customer or click &quot;+ New&quot; above to log the unpaid balance.
                      </p>
                    </div>
                  </div>
                )}

                {/* Partial Deposit Amount Input */}
                {settlementMode === "PARTIAL" && (
                  <div className="space-y-2 p-2.5 rounded-subtle bg-amber-500/5 border border-amber-500/20">
                    <label className="block text-[11px] font-semibold text-amber-300">
                      Amount Paid Today (₦):
                    </label>
                    <input
                      type="number"
                      value={partialAmountPaid}
                      onChange={(e) => setPartialAmountPaid(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full h-8 px-2.5 rounded-subtle border border-amber-500/30 bg-surface text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <div className="flex justify-between items-center text-[11px] pt-0.5">
                      <span className="text-text-muted">Balance on Credit:</span>
                      <span className="font-bold text-amber-400 font-mono">
                        {formatNaira(unpaidDebtThisSale)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 100% Credit Notice */}
                {settlementMode === "CREDIT" && (
                  <div className="p-2.5 rounded-subtle bg-rose-500/5 border border-rose-500/20 text-[11px] space-y-1">
                    <div className="flex justify-between items-center text-text-secondary">
                      <span>Paid Today:</span>
                      <span className="font-mono font-bold text-text-primary">₦0.00</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-300 font-bold">
                      <span>Total Added to Customer Debt:</span>
                      <span className="font-mono">{formatNaira(grandTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Credit Health Projection Card */}
                {(settlementMode === "PARTIAL" || settlementMode === "CREDIT") && selectedCustomer && (
                  <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border text-[11px] space-y-1">
                    <div className="flex justify-between text-text-secondary">
                      <span>Current Outstanding:</span>
                      <span className="font-mono font-medium">{formatNaira(customerCurrentDebt)}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>New Debt from this Sale:</span>
                      <span className="font-mono font-semibold text-amber-400">+{formatNaira(unpaidDebtThisSale)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border font-bold text-text-primary">
                      <span>Projected New Debt:</span>
                      <span className="font-mono">{formatNaira(projectedTotalDebt)}</span>
                    </div>
                    {customerCreditLimit > 0 && (
                      <div className="pt-1 flex items-center justify-between text-[10px]">
                        <span className="text-text-muted">Limit: {formatNaira(customerCreditLimit)}</span>
                        {isExceedingCreditLimit ? (
                          <span className="text-status-danger font-bold">⚠️ Exceeds Limit by {formatNaira(overLimitAmount)}</span>
                        ) : (
                          <span className="text-status-success font-medium">Within Limit</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Payment Method Selector (For Full or Partial deposit) */}
                {settlementMode !== "CREDIT" && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-text-secondary">
                      Payment Method {settlementMode === "PARTIAL" ? "for Deposit" : ""}:
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={`py-2 px-3 rounded-subtle font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                          paymentMethod === "CASH"
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "bg-surface-elevated/40 border-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Cash
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod("BANK_TRANSFER")}
                        className={`py-2 px-3 rounded-subtle font-medium border flex items-center justify-center gap-1.5 transition-colors ${
                          paymentMethod === "BANK_TRANSFER"
                            ? "bg-brand text-white border-brand shadow-sm"
                            : "bg-surface-elevated/40 border-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Bank Transfer
                      </button>
                    </div>

                    {/* Cash Tendered for Full Settlement */}
                    {settlementMode === "FULL" && paymentMethod === "CASH" && (
                      <div className="space-y-2 p-3 rounded-subtle bg-surface-elevated/30 border border-border">
                        <label className="block text-[11px] font-medium text-text-secondary">
                          Cash Received from Customer (₦):
                        </label>
                        <input
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          placeholder={grandTotal.toString()}
                          className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="text-text-muted">Calculated Change:</span>
                          <span className="font-bold text-status-success font-mono">
                            {formatNaira(changeDue)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bank Transfer Reference */}
                    {paymentMethod === "BANK_TRANSFER" && (
                      <div className="space-y-2 p-3 rounded-subtle bg-surface-elevated/30 border border-border text-xs">
                        <label className="block text-[11px] font-medium text-text-secondary">
                          Transaction Reference / Narration:
                        </label>
                        <input
                          type="text"
                          value={transferRef}
                          onChange={(e) => setTransferRef(e.target.value)}
                          placeholder="e.g. GTB/TRF/984210"
                          className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Complete Sale Button */}
                <Button
                  onClick={handleCompleteSale}
                  isLoading={isSubmitting}
                  className="w-full h-11 text-sm font-bold shadow-md gap-2"
                >
                  <span>
                    {settlementMode === "FULL" && `Complete Sale (${formatNaira(grandTotal)})`}
                    {settlementMode === "PARTIAL" && `Process Deposit & Credit (${formatNaira(depositPaidNumber)})`}
                    {settlementMode === "CREDIT" && `Issue Store Credit (${formatNaira(grandTotal)})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Mobile & Tablet Floating Cart Checkout Bar */}
      {cart.length > 0 && !completedSale && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 bg-surface-elevated/95 backdrop-blur-md border border-brand/50 shadow-2xl rounded-card p-3 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center text-brand">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-text-primary">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} {cart.length === 1 ? "item" : "items"} in cart
              </div>
              <div className="text-sm font-bold text-brand font-mono">
                {formatNaira(grandTotal)}
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => {
              document.getElementById("pos-cart-panel")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold px-4 py-2 shadow-lg gap-1.5"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Completion Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-surface border border-border rounded-sheet max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-status-success/15 text-status-success mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <div className="text-xs font-bold tracking-wider uppercase text-text-muted mb-1 flex items-center justify-center gap-0.5">
                <span>Frank</span><span className="text-brand">Lucy</span> Commercial Operations
              </div>
              <h3 className="text-lg font-bold text-text-primary">
                Sale Successfully Completed
              </h3>
              <p className="font-mono text-xs text-brand font-semibold mt-1">
                {completedSale.invoiceNumber}
              </p>
            </div>

            <div className="p-4 rounded-subtle bg-surface-elevated/40 border border-border space-y-2 text-xs">
              <div className="flex justify-between text-[11px] text-text-muted pb-1 border-b border-border">
                <span>Business:</span>
                <span className="font-bold text-text-primary">
                  Frank<span className="text-brand">Lucy</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Purchase:</span>
                <span className="font-bold text-text-primary text-sm font-mono">
                  {formatNaira(completedSale.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Amount Paid:</span>
                <span className="font-bold text-emerald-400 text-sm font-mono">
                  {formatNaira(completedSale.amountPaid || completedSale.total)}
                </span>
              </div>
              {completedSale.unpaidBalance && Number(completedSale.unpaidBalance) > 0 && (
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-muted">Remaining Balance (Debt):</span>
                  <span className="font-bold text-amber-400 text-sm font-mono">
                    {formatNaira(completedSale.unpaidBalance)}
                  </span>
                </div>
              )}
              {completedSale.changeDue && Number(completedSale.changeDue) > 0 && (
                <div className="flex justify-between pt-1 border-t border-border">
                  <span className="text-text-muted">Change Given to Customer:</span>
                  <span className="font-bold text-status-success text-sm font-mono">
                    {formatNaira(completedSale.changeDue)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-text-muted pt-1">
                <span>Branch:</span>
                <span>
                  {branchName} ({branchCode})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => window.open(`/sales/${completedSale.saleId}/invoice`, "_blank")}
                className="flex-1 text-xs gap-1.5 border-brand/40 text-brand hover:bg-brand/10 font-bold"
              >
                <Printer className="w-3.5 h-3.5" />
                View & Print Invoice
              </Button>
              <Button
                variant="primary"
                onClick={startNewSale}
                className="flex-1 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                New Sale
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Open Cash Drawer Session Modal */}
      {openSessionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="bg-surface border-border max-w-sm w-full p-5 shadow-2xl animate-scaleUp">
            <form onSubmit={handleOpenCashSession} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-text-primary">
                    Open Cash Drawer Session
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenSessionModalOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  Declare your physical starting cash (drawer float). This links all subsequent cash transactions to your shift reconciliation.
                </p>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Opening Cash Amount (NGN) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    placeholder="e.g. 10000"
                    value={openingCashInput}
                    onChange={(e) => setOpeningCashInput(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-sm text-text-primary font-mono focus:outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-text-muted mt-0.5 block">
                    Enter 0 if starting with an empty cash drawer.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenSessionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isOpeningSession}
                  className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold"
                >
                  {isOpeningSession ? "Opening..." : "Confirm & Start Session"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Cash Payout / Safe Drop Modal */}
      {payoutModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <Card className="bg-surface border-border max-w-md w-full p-5 shadow-2xl animate-scaleUp">
            <form onSubmit={handleRecordPayout} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-text-primary">
                    Record Drawer Cash Drop / Payout
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPayoutModalOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {payoutSuccessMsg && (
                <div className="p-3 rounded-subtle bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  {payoutSuccessMsg}
                </div>
              )}

              {payoutError && (
                <div className="p-3 rounded-subtle bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs">
                  {payoutError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Payout Category *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "FUEL", label: "Generator Fuel" },
                      { id: "LOGISTICS", label: "Dispatch / Delivery" },
                      { id: "SUPPLIES", label: "Store Supplies" },
                      { id: "CASH_DROP", label: "Safe Drop (Excess Cash)" },
                      { id: "OWNER_WITHDRAWAL", label: "Owner Withdrawal" },
                      { id: "OTHER", label: "Other Store Expense" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setPayoutCategory(cat.id as any)}
                        className={`px-2.5 py-1.5 rounded-subtle text-[11px] font-medium border text-left transition-colors ${
                          payoutCategory === cat.id
                            ? "bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold"
                            : "bg-surface-elevated/40 border-border text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Amount Withdrawn from Drawer (₦) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-sm text-text-primary font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <span className="text-[10px] text-text-muted mt-1 block">
                    This amount will be deducted from drawer expected cash so your shift reconciles with 100% accuracy.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Purpose / Expense Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={payoutReason}
                    onChange={(e) => setPayoutReason(e.target.value)}
                    placeholder="e.g. 50L Diesel purchase for generator"
                    className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted uppercase mb-1">
                      Recipient / Paid To
                    </label>
                    <input
                      type="text"
                      value={payoutRecipient}
                      onChange={(e) => setPayoutRecipient(e.target.value)}
                      placeholder="e.g. TotalEnergies Station"
                      className="w-full px-2.5 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-text-muted uppercase mb-1">
                      Receipt / Voucher No.
                    </label>
                    <input
                      type="text"
                      value={payoutReference}
                      onChange={(e) => setPayoutReference(e.target.value)}
                      placeholder="e.g. REC-8904"
                      className="w-full px-2.5 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPayoutModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingPayout || !payoutAmount || !payoutReason}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  {isSubmittingPayout ? "Recording..." : "Confirm Cash Withdrawal"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Close Cash Drawer Session Modal */}
      {closeSessionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <Card className="bg-surface border-border max-w-md w-full p-5 shadow-2xl animate-scaleUp">
            <form onSubmit={handleCloseCashSession} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-status-warning" />
                  <h3 className="text-sm font-bold text-text-primary">
                    Close Cash Drawer & Reconcile Shift
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCloseSessionModalOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {closeSessionError && (
                <div className="p-3 rounded-subtle bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs">
                  {closeSessionError}
                </div>
              )}

              {isLoadingSummary ? (
                <div className="py-8 text-center text-text-muted text-xs">
                  <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Calculating shift sales and expected drawer totals...
                </div>
              ) : sessionSummary ? (
                <div className="space-y-3.5 text-xs">
                  {/* Summary Breakdown Box */}
                  <div className="p-3 rounded-subtle bg-surface-elevated/60 border border-border space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between text-text-muted">
                      <span>Opening Float:</span>
                      <span>{formatNaira(sessionSummary.openingCash)}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Cash Sales Collected:</span>
                      <span className="text-emerald-400">+{formatNaira(sessionSummary.cashSales)}</span>
                    </div>
                    {parseFloat(sessionSummary.cashRefunds || "0") > 0 && (
                      <div className="flex justify-between text-status-danger">
                        <span>Cash Refunds:</span>
                        <span>-{formatNaira(sessionSummary.cashRefunds)}</span>
                      </div>
                    )}
                    {parseFloat(sessionSummary.cashPayouts || "0") > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span>Cash Drops & Store Payouts:</span>
                        <span>-{formatNaira(sessionSummary.cashPayouts)}</span>
                      </div>
                    )}
                    <div className="pt-1.5 border-t border-border flex justify-between font-bold text-text-primary text-xs">
                      <span>Expected Cash in Drawer:</span>
                      <span className="text-brand">{formatNaira(sessionSummary.expectedCash)}</span>
                    </div>
                    <div className="flex justify-between text-text-muted text-[10px]">
                      <span>Bank Transfers Recorded:</span>
                      <span>{formatNaira(sessionSummary.expectedTransfer)}</span>
                    </div>
                  </div>

                  {/* Itemized Payouts this shift */}
                  {sessionSummary.payouts && sessionSummary.payouts.length > 0 && (
                    <div className="p-2.5 rounded-subtle bg-surface border border-border/80 text-[11px] space-y-1.5">
                      <div className="font-semibold text-text-secondary text-[10px] uppercase tracking-wider flex items-center justify-between">
                        <span>Shift Cash Drops & Payouts ({sessionSummary.payouts.length})</span>
                        <span className="text-amber-400 font-mono font-bold">-{formatNaira(sessionSummary.cashPayouts)}</span>
                      </div>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {sessionSummary.payouts.map((po: any) => (
                          <div key={po.id} className="flex justify-between items-center text-text-muted text-[10px]">
                            <span className="truncate max-w-[200px]">[{po.category}] {po.reason}</span>
                            <span className="font-mono text-amber-300 font-semibold shrink-0">-{formatNaira(po.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Physical Cash Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                        Physical Cash Counted (NGN) *
                      </label>
                      {declaredCashInput && (
                        <span className={`text-[10px] font-bold font-mono ${
                          parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0") === 0
                            ? "text-emerald-400"
                            : parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0") < 0
                            ? "text-status-danger"
                            : "text-cyan-400"
                        }`}>
                          {parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0") === 0
                            ? "✓ Balanced (₦0)"
                            : parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0") < 0
                            ? `Shortage: ${formatNaira(parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0"))}`
                            : `Overage: +${formatNaira(parseFloat(declaredCashInput || "0") - parseFloat(sessionSummary.expectedCash || "0"))}`}
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      required
                      placeholder="e.g. 135000"
                      value={declaredCashInput}
                      onChange={(e) => setDeclaredCashInput(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-subtle text-sm text-text-primary font-mono focus:outline-none focus:border-brand"
                    />
                  </div>

                  {/* Declared Bank Transfers */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                      Bank Transfers Verified (NGN) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      value={declaredTransferInput}
                      onChange={(e) => setDeclaredTransferInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary font-mono focus:outline-none focus:border-brand"
                    />
                  </div>

                  {/* Notes / Explanation */}
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-1">
                      Shift Notes / Discrepancy Reason (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={500}
                      placeholder="e.g. Cash count short by ₦200 due to change discrepancy"
                      value={closingNotesInput}
                      onChange={(e) => setClosingNotesInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCloseSessionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isClosingSession || isLoadingSummary}
                  className="bg-status-warning hover:bg-status-warning/90 text-surface-950 text-xs font-semibold"
                >
                  {isClosingSession ? "Closing..." : "Finalize & Close Drawer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Quick Customer Creation Modal */}
      {quickCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="bg-surface border-border max-w-sm w-full p-5 shadow-2xl animate-scaleUp">
            <form onSubmit={handleQuickCreateCustomer} className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-bold text-text-primary">
                    Register Customer Account
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickCustomerModalOpen(false)}
                  className="text-text-muted hover:text-text-primary p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {quickCreateError && (
                <div className="p-2.5 bg-status-danger/10 border border-status-danger/30 rounded-subtle text-status-danger text-xs">
                  {quickCreateError}
                </div>
              )}

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickName}
                    onChange={(e) => setQuickName(e.target.value)}
                    placeholder="e.g. Chief Emeka Okoro"
                    className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={quickPhone}
                    onChange={(e) => setQuickPhone(e.target.value)}
                    placeholder="e.g. 0803 123 4567"
                    className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Address / Location
                  </label>
                  <input
                    type="text"
                    value={quickAddress}
                    onChange={(e) => setQuickAddress(e.target.value)}
                    placeholder="e.g. 12 Commercial Way, Ikeja"
                    className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1">
                    Credit Limit (₦)
                  </label>
                  <input
                    type="number"
                    value={quickCreditLimit}
                    onChange={(e) => setQuickCreditLimit(e.target.value)}
                    placeholder="0"
                    className="w-full h-8 px-2.5 rounded-subtle border border-border bg-surface-elevated/40 text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                  <p className="text-[10px] text-text-muted mt-0.5">
                    Leave as 0 for no credit restriction.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickCustomerModalOpen(false)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isQuickCreating}
                  className="flex-1 text-xs font-bold"
                >
                  Create & Select
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Custom Quantity & Unit Selection Modal */}
      {unitModalProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <Card className="bg-surface border-border max-w-md w-full p-5 shadow-2xl animate-scaleUp">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand" />
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Add to Sale: {unitModalProduct.name}
                    </h3>
                    <p className="text-[11px] font-mono text-text-muted">
                      SKU: {unitModalProduct.sku}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUnitModalProduct(null)}
                  className="text-text-muted hover:text-text-primary p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Stock Status Banner */}
              <div className="p-2.5 rounded-subtle bg-surface-elevated/60 border border-border flex items-center justify-between text-xs">
                <span className="text-text-secondary">Available Stock:</span>
                <span className="font-semibold text-text-primary">
                  {formatStockDisplay(
                    unitModalProduct.currentStock,
                    unitModalProduct.bulkUnit,
                    unitModalProduct.pieceUnit,
                    unitModalProduct.piecesPerBulk
                  )}
                </span>
              </div>

              {/* Unit Type Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Select Selling Unit
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Bulk Unit */}
                  <button
                    type="button"
                    onClick={() => setUnitModalType("BULK")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      unitModalType === "BULK"
                        ? "bg-brand/20 border-brand text-white shadow-xs"
                        : "bg-surface-elevated/40 border-border text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase">
                        {unitModalProduct.bulkUnit}
                      </span>
                      {unitModalProduct.piecesPerBulk > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                          {unitModalProduct.piecesPerBulk} {unitModalProduct.pieceUnit}s
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm font-bold text-text-primary font-mono">
                      {formatNaira(unitModalProduct.sellingPrice)}
                    </div>
                  </button>

                  {/* Loose Piece Unit */}
                  {unitModalProduct.piecesPerBulk > 1 ? (
                    <button
                      type="button"
                      onClick={() => setUnitModalType("PIECE")}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        unitModalType === "PIECE"
                          ? "bg-brand/20 border-brand text-white shadow-xs"
                          : "bg-surface-elevated/40 border-border text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase">
                          {unitModalProduct.pieceUnit} (Loose)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted">
                          1 unit
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-text-primary font-mono">
                        {formatNaira(
                          unitModalProduct.piecePrice ||
                            Math.ceil(
                              unitModalProduct.sellingPrice /
                                (unitModalProduct.piecesPerBulk || 1)
                            )
                        )}
                      </div>
                    </button>
                  ) : (
                    <div className="p-3 rounded-lg border border-dashed border-border/60 bg-surface-elevated/10 text-text-muted text-xs flex items-center justify-center text-center">
                      Single piece pricing not configured
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Input with Quick Chips */}
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
                  Quantity ({unitModalType === "BULK" ? unitModalProduct.bulkUnit : unitModalProduct.pieceUnit})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitModalQty(Math.max(1, unitModalQty - 1))}
                    className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-primary hover:bg-surface-hover"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={unitModalQty}
                    onChange={(e) =>
                      setUnitModalQty(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 h-10 text-center font-bold text-base bg-surface-elevated border border-border rounded-lg text-text-primary focus:outline-none focus:ring-1 focus:ring-brand font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setUnitModalQty(unitModalQty + 1)}
                    className="w-10 h-10 rounded-lg bg-surface-elevated border border-border flex items-center justify-center text-text-primary hover:bg-surface-hover"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Quick Quantity Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  {[1, 2, 5, 6, 12, 24, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setUnitModalQty(preset)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-md border transition-colors ${
                        unitModalQty === preset
                          ? "bg-brand text-white border-brand"
                          : "bg-surface-elevated border-border text-text-secondary hover:text-text-primary hover:border-brand/40"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setUnitModalQty(unitModalQty + 10)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-md border bg-surface-elevated border-border text-text-secondary hover:text-text-primary"
                  >
                    +10
                  </button>
                </div>
              </div>

              {/* Live Cost Calculation Summary */}
              {(() => {
                const currentUnitPrice =
                  unitModalType === "PIECE"
                    ? unitModalProduct.piecePrice ||
                      Math.ceil(
                        unitModalProduct.sellingPrice /
                          (unitModalProduct.piecesPerBulk || 1)
                      )
                    : unitModalProduct.sellingPrice;
                const totalItemCost = currentUnitPrice * unitModalQty;
                return (
                  <div className="p-3 rounded-lg bg-surface-elevated/70 border border-border flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-text-muted">Line Total:</span>
                      <p className="text-xs text-text-secondary font-medium">
                        {unitModalQty} x {formatNaira(currentUnitPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-brand font-mono">
                        {formatNaira(totalItemCost)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setUnitModalProduct(null)}
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    addToCart(unitModalProduct, unitModalType, unitModalQty);
                    setUnitModalProduct(null);
                  }}
                  className="flex-1 text-xs font-bold"
                >
                  Add {unitModalQty} {unitModalType === "BULK" ? unitModalProduct.bulkUnit : unitModalProduct.pieceUnit} to Cart
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
