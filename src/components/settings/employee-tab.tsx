"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  Shield,
  ShieldAlert,
  ArrowRightLeft,
  Building2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Mail,
  Phone,
  Briefcase,
  TrendingUp,
  UserX,
  BadgeCheck,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmployeeItem, BranchItem } from "./types";

interface EmployeeTabProps {
  employees: EmployeeItem[];
  setEmployees: React.Dispatch<React.SetStateAction<EmployeeItem[]>>;
  branches: BranchItem[];
  showToast: (type: "success" | "error", text: string) => void;
  openAddModal: boolean;
  setOpenAddModal: (open: boolean) => void;
}

export const EmployeeTab: React.FC<EmployeeTabProps> = ({
  employees,
  setEmployees,
  branches,
  showToast,
  openAddModal,
  setOpenAddModal,
}) => {
  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  // Add Employee Form State
  const [addFirstName, setAddFirstName] = useState("");
  const [addLastName, setAddLastName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("Password123!");
  const [addPhone, setAddPhone] = useState("");
  const [addRole, setAddRole] = useState("CASHIER");
  const [addBranchId, setAddBranchId] = useState(branches[0]?.id || "");
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Promote / Demote Role Modal State
  const [roleModalEmployee, setRoleModalEmployee] = useState<EmployeeItem | null>(null);
  const [targetRole, setTargetRole] = useState("CASHIER");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Transfer Branch Modal State
  const [transferModalEmployee, setTransferModalEmployee] = useState<EmployeeItem | null>(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferFormError, setTransferFormError] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);

  // Toggle Status Modal State
  const [statusCandidate, setStatusCandidate] = useState<EmployeeItem | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const matchesName = emp.fullName.toLowerCase().includes(q);
        const matchesNum = emp.employeeNumber.toLowerCase().includes(q);
        const matchesEmail = emp.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesNum && !matchesEmail) return false;
      }

      if (roleFilter !== "ALL" && emp.roleName !== roleFilter) return false;
      if (branchFilter !== "ALL" && emp.branchId !== branchFilter) return false;

      return true;
    });
  }, [employees, search, roleFilter, branchFilter]);

  // Metric counts
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.status === "ACTIVE").length;
  const managerCount = employees.filter((e) => e.roleName === "MANAGER").length;
  const cashierCount = employees.filter((e) => e.roleName === "CASHIER").length;
  const stockkeeperCount = employees.filter((e) => e.roleName === "STOCKKEEPER").length;
  const salespersonCount = employees.filter((e) => e.roleName === "SALESPERSON").length;

  const handleOpenAddModal = () => {
    setAddFirstName("");
    setAddLastName("");
    setAddEmail("");
    setAddPassword("Password123!");
    setAddPhone("");
    setAddRole("CASHIER");
    setAddBranchId(branches[0]?.id || "");
    setAddFormError(null);
    setOpenAddModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddFormError(null);
    setIsSubmittingAdd(true);

    try {
      const res = await fetch("/api/settings/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: addFirstName,
          lastName: addLastName,
          email: addEmail,
          password: addPassword,
          phone: addPhone,
          roleName: addRole,
          branchId: addBranchId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create employee.");

      const selectedBranch = branches.find((b) => b.id === addBranchId);
      const newEmp: EmployeeItem = {
        id: data.employee.id,
        userId: data.employee.userId,
        employeeNumber: data.employee.employeeNumber,
        firstName: data.employee.firstName,
        lastName: data.employee.lastName,
        fullName: `${data.employee.firstName} ${data.employee.lastName}`,
        phone: data.employee.phone,
        status: data.employee.status,
        userStatus: "ACTIVE",
        email: data.employee.email,
        roleId: null,
        roleName: data.employee.roleName,
        branchId: addBranchId,
        branchName: selectedBranch?.name || "Unassigned",
        branchCode: selectedBranch?.code || "-",
        salesCount: 0,
        attendancesCount: 0,
        isOwner: false,
        createdAt: data.employee.createdAt,
      };

      setEmployees((prev) => [newEmp, ...prev]);
      setOpenAddModal(false);
      showToast(
        "success",
        `Employee '${newEmp.fullName}' (${newEmp.employeeNumber}) created as ${newEmp.roleName}.`
      );
    } catch (err: any) {
      setAddFormError(err.message || "Failed to create employee.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Open Role Modal
  const handleOpenRoleModal = (emp: EmployeeItem) => {
    setRoleModalEmployee(emp);
    setTargetRole(emp.roleName === "MANAGER" ? "CASHIER" : "MANAGER");
    setRoleChangeReason("");
    setRoleFormError(null);
  };

  const handleSaveRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalEmployee) return;

    setRoleFormError(null);
    setIsSubmittingRole(true);

    try {
      const res = await fetch(`/api/settings/employees/${roleModalEmployee.id}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRole: targetRole,
          reason: roleChangeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change employee role.");

      setEmployees((prev) =>
        prev.map((e) =>
          e.id === roleModalEmployee.id ? { ...e, roleName: targetRole } : e
        )
      );

      const oldRole = roleModalEmployee.roleName;
      setRoleModalEmployee(null);
      showToast(
        "success",
        `${roleModalEmployee.fullName} role changed from ${oldRole} to ${targetRole}.`
      );
    } catch (err: any) {
      setRoleFormError(err.message || "Failed to update role.");
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Open Transfer Modal
  const handleOpenTransferModal = (emp: EmployeeItem) => {
    setTransferModalEmployee(emp);
    const otherBranch = branches.find((b) => b.id !== emp.branchId);
    setTargetBranchId(otherBranch?.id || branches[0]?.id || "");
    setTransferReason("");
    setTransferFormError(null);
  };

  const handleSaveBranchTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalEmployee) return;

    setTransferFormError(null);
    setIsSubmittingTransfer(true);

    try {
      const res = await fetch(`/api/settings/employees/${transferModalEmployee.id}/transfer`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: targetBranchId,
          reason: transferReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to transfer employee.");

      const targetBranch = branches.find((b) => b.id === targetBranchId);
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === transferModalEmployee.id
            ? {
                ...e,
                branchId: targetBranchId,
                branchName: targetBranch?.name || e.branchName,
                branchCode: targetBranch?.code || e.branchCode,
              }
            : e
        )
      );

      setTransferModalEmployee(null);
      showToast(
        "success",
        `${transferModalEmployee.fullName} transferred to ${targetBranch?.name} successfully.`
      );
    } catch (err: any) {
      setTransferFormError(err.message || "Failed to transfer employee.");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Handle Toggle Status (Active / Inactive)
  const handleToggleStatus = async (emp: EmployeeItem) => {
    setIsSubmittingStatus(true);
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const res = await fetch(`/api/settings/employees/${emp.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update employee status.");

      setEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, status: nextStatus, userStatus: nextStatus } : e))
      );

      setStatusCandidate(null);
      showToast(
        "success",
        `${emp.fullName} account is now ${nextStatus === "ACTIVE" ? "Active" : "Inactive"}.`
      );
    } catch (err: any) {
      showToast("error", err.message || "Failed to change employee status.");
      setStatusCandidate(null);
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case "OWNER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Shield className="w-3 h-3" />
            OWNER
          </span>
        );
      case "MANAGER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20">
            <BadgeCheck className="w-3 h-3" />
            MANAGER
          </span>
        );
      case "SALESPERSON":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <ShoppingBag className="w-3 h-3" />
            SALESPERSON
          </span>
        );
      case "CASHIER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Briefcase className="w-3 h-3" />
            CASHIER
          </span>
        );
      case "STOCKKEEPER":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Briefcase className="w-3 h-3" />
            STOCKKEEPER
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-text-muted">
            {roleName}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Total Staff</div>
          <div className="text-xl font-bold text-text-primary mt-1">{totalCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Enterprise workforce</div>
        </Card>
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Active Accounts</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{activeCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Permitted to log in</div>
        </Card>
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Salespersons</div>
          <div className="text-xl font-bold text-violet-400 mt-1">{salespersonCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Sales & Stock associates</div>
        </Card>
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Managers</div>
          <div className="text-xl font-bold text-brand mt-1">{managerCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Branch supervisors</div>
        </Card>
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Cashiers</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{cashierCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">POS & Drawer staff</div>
        </Card>
        <Card className="p-3 bg-surface border-border">
          <div className="text-[10px] font-medium text-text-muted uppercase">Stockkeepers</div>
          <div className="text-xl font-bold text-cyan-400 mt-1">{stockkeeperCount}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Warehouse custodians</div>
        </Card>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface p-3 rounded-subtle border border-border">
        <div className="flex flex-col sm:flex-row items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search by name, email, or EMP ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-brand font-medium w-full sm:w-auto"
            >
              <option value="ALL">All Roles</option>
              <option value="SALESPERSON">Salespersons</option>
              <option value="MANAGER">Managers</option>
              <option value="CASHIER">Cashiers</option>
              <option value="STOCKKEEPER">Stockkeepers</option>
              <option value="OWNER">Owner</option>
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-elevated border border-border rounded-subtle text-xs text-text-primary focus:outline-none focus:border-brand font-medium w-full sm:w-auto"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button
          size="sm"
          onClick={handleOpenAddModal}
          className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold gap-1.5 shadow-sm shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add New Employee</span>
        </Button>
      </div>

      {/* Executive Workforce Grid */}
      {filteredEmployees.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-border">
          <Users className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
          <p className="text-xs text-text-muted">No employees match your search or filter criteria.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase();
            const isOwner = emp.isOwner || emp.roleName === "OWNER";

            return (
              <Card
                key={emp.id}
                className="relative overflow-hidden p-5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/[0.08] via-surface to-surface border border-violet-500/20 hover:border-violet-500/40 transition-all duration-300 flex flex-col justify-between shadow-xs space-y-4 rounded-card"
              >
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-20 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="space-y-3.5 relative">
                  {/* Top Bar: Role badge + Status Chip */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-border">
                    {getRoleBadge(emp.roleName)}
                    {emp.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active Staff
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-elevated text-text-muted">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md ${
                        isOwner
                          ? "bg-gradient-to-br from-amber-500 to-amber-700"
                          : emp.roleName === "MANAGER"
                          ? "bg-gradient-to-br from-indigo-500 to-indigo-700"
                          : emp.roleName === "SALESPERSON"
                          ? "bg-gradient-to-br from-violet-500 to-violet-700"
                          : emp.roleName === "CASHIER"
                          ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
                          : "bg-gradient-to-br from-cyan-500 to-cyan-700"
                      }`}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-text-primary text-sm truncate">
                        {emp.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-text-muted mt-0.5">
                        {emp.employeeNumber}
                      </div>
                    </div>
                  </div>

                  {/* Contact & Branch Location */}
                  <div className="p-2.5 rounded-subtle bg-surface-elevated/40 border border-border/60 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-text-secondary truncate">
                      <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                      <span className="font-medium text-text-primary truncate">{emp.branchName}</span>
                      <span className="font-mono text-[10px] text-text-muted">({emp.branchCode})</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-text-muted text-[11px] truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      <span className="truncate">{emp.email || "No email"}</span>
                    </div>

                    {emp.phone && (
                      <div className="flex items-center gap-1.5 text-text-muted text-[11px] truncate">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Operational Record Gauge */}
                  <div className="flex items-center justify-between text-xs px-1 text-text-secondary">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-text-primary">{emp.salesCount}</span>
                      <span className="text-[11px] text-text-muted">Sales Processed</span>
                    </div>
                    <span className="text-border">·</span>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-text-primary">{emp.attendancesCount}</span>
                      <span className="text-[11px] text-text-muted">Shifts Logged</span>
                    </div>
                  </div>
                </div>

                {/* Executive Control Footer */}
                <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                  {isOwner ? (
                    <span className="text-[11px] text-text-muted italic flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-500" />
                      <span>Executive Account</span>
                    </span>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRoleModal(emp)}
                          className="h-7 px-2.5 text-xs text-text-secondary hover:text-text-primary gap-1"
                        >
                          <TrendingUp className="w-3 h-3 text-brand" />
                          <span>Role</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenTransferModal(emp)}
                          className="h-7 px-2.5 text-xs text-text-secondary hover:text-text-primary gap-1"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-brand" />
                          <span>Transfer</span>
                        </Button>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatusCandidate(emp)}
                        className={`h-7 px-2 text-xs font-semibold ${
                          emp.status === "ACTIVE"
                            ? "text-status-danger hover:bg-status-danger-subtle"
                            : "text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        {emp.status === "ACTIVE" ? (
                          <span className="flex items-center gap-1">
                            <UserX className="w-3 h-3" />
                            <span>Deactivate</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Activate</span>
                          </span>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD NEW EMPLOYEE */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL: ADD NEW EMPLOYEE */}
      {/* ========================================================================= */}
      {openAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-lg max-h-[88vh] flex flex-col animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-16 bg-brand/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent pointer-events-none" />

            <form onSubmit={handleCreateEmployee} className="flex flex-col flex-1 overflow-hidden">
              {/* Fixed Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0 relative bg-surface/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Create New Staff Account
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Establish credentials, branch assignment & role</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenAddModal(false)}
                  className="w-7 h-7 rounded-lg bg-surface-elevated/60 text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1 overscroll-contain">
                {addFormError && (
                  <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{addFormError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samuel"
                      value={addFirstName}
                      onChange={(e) => setAddFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Adeyemi"
                      value={addLastName}
                      onChange={(e) => setAddLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Email Address (Login ID) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. samuel@franklucy.com"
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Initial Password *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
                      value={addPassword}
                      onChange={(e) => setAddPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                      Role & Permissions *
                    </label>
                    <select
                      value={addRole}
                      onChange={(e) => setAddRole(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand font-medium transition-colors"
                    >
                      <option value="SALESPERSON">SALESPERSON (Frontline: POS Sales & Stock Receiving)</option>
                      <option value="CASHIER">CASHIER (Point of Sale, Daily Drawer)</option>
                      <option value="STOCKKEEPER">STOCKKEEPER (Inventory Receipts & Movements)</option>
                      <option value="MANAGER">MANAGER (Branch Supervision, Must Clock Shift)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Initial Branch Assignment *
                  </label>
                  <select
                    value={addBranchId}
                    onChange={(e) => setAddBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand font-medium transition-colors"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code}) · {b.status}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-text-muted mt-0.5 block">
                    Staff will be issued an employee number tied to this branch code and assigned to its active roster.
                  </span>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-border/60 bg-surface-elevated/40 shrink-0 relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenAddModal(false)}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingAdd}
                  className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg px-4"
                >
                  {isSubmittingAdd ? "Creating..." : "Create Employee Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROMOTE / DEMOTE (CHANGE ROLE) */}
      {/* ========================================================================= */}
      {roleModalEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-16 bg-brand/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent pointer-events-none" />

            <form onSubmit={handleSaveRoleChange} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0 relative bg-surface/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Change Role: {roleModalEmployee.fullName}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Staff promotion, demotion or reassignment</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleModalEmployee(null)}
                  className="w-7 h-7 rounded-lg bg-surface-elevated/60 text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1 overscroll-contain">
                {roleFormError && (
                  <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{roleFormError}</span>
                  </div>
                )}

                <div className="p-3 bg-surface-elevated/40 border border-border rounded-lg flex items-center justify-between">
                  <span className="text-text-muted">Current Role:</span>
                  <span className="font-bold text-text-primary">{roleModalEmployee.roleName}</span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    New Target Role *
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand font-medium transition-colors"
                  >
                    <option value="SALESPERSON">SALESPERSON (Frontline: POS Sales & Stock Receiving)</option>
                    <option value="MANAGER">MANAGER (Promotion: Must Clock Attendance)</option>
                    <option value="CASHIER">CASHIER (Reassignment: Point of Sale & Cash handling)</option>
                    <option value="STOCKKEEPER">STOCKKEEPER (Reassignment: Inventory receiving & custody)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Reason for Role Change / Executive Notes *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Promoted to Branch Manager following strong annual performance and accurate cash reconciliations."
                    value={roleChangeReason}
                    onChange={(e) => setRoleChangeReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand resize-none transition-colors"
                  />
                  <span className="text-[10px] text-text-muted mt-0.5 block">
                    This note will be logged in the permanent audit trail for accountability.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-border/60 bg-surface-elevated/40 shrink-0 relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRoleModalEmployee(null)}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingRole}
                  className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg px-4"
                >
                  {isSubmittingRole ? "Updating..." : "Confirm Role Change"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TRANSFER BRANCH */}
      {/* ========================================================================= */}
      {transferModalEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-md max-h-[88vh] flex flex-col animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-16 bg-brand/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent pointer-events-none" />

            <form onSubmit={handleSaveBranchTransfer} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 shrink-0 relative bg-surface/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">
                      Transfer Staff: {transferModalEmployee.fullName}
                    </h3>
                    <p className="text-[10px] text-text-muted mt-0.5">Redeploy to another physical commercial outlet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTransferModalEmployee(null)}
                  className="w-7 h-7 rounded-lg bg-surface-elevated/60 text-text-muted hover:text-text-primary flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs flex-1 overscroll-contain">
                {transferFormError && (
                  <div className="p-3 rounded-lg bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{transferFormError}</span>
                  </div>
                )}

                <div className="p-3 bg-surface-elevated/40 border border-border rounded-lg flex items-center justify-between">
                  <span className="text-text-muted">Current Assigned Branch:</span>
                  <span className="font-bold text-text-primary">
                    {transferModalEmployee.branchName} ({transferModalEmployee.branchCode})
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Destination Branch *
                  </label>
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand font-medium transition-colors"
                  >
                    {branches
                      .filter((b) => b.id !== transferModalEmployee.branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code}) · {b.status}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-text-secondary mb-1">
                    Transfer Reason *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Redeployed to assist Mainland branch during festive sales peak."
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand resize-none transition-colors"
                  />
                </div>

                <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg text-[11px] text-text-secondary leading-relaxed">
                  <strong className="text-brand block mb-1">Component 1 Audit Guarantee:</strong>
                  All historical sales, drawer sessions, stock transactions, and attendance records stay permanently tied to the original branch. The staff member&apos;s past assignment is closed and a new assignment is opened for the destination branch.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 border-t border-border/60 bg-surface-elevated/40 shrink-0 relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferModalEmployee(null)}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingTransfer}
                  className="bg-brand hover:bg-brand-hover text-white text-xs font-semibold rounded-lg px-4"
                >
                  {isSubmittingTransfer ? "Transferring..." : "Confirm Branch Transfer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TOGGLE STATUS (DEACTIVATE / ACTIVATE) */}
      {/* ========================================================================= */}
      {statusCandidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
          <div className="relative overflow-hidden bg-surface/95 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] rounded-2xl w-full max-w-sm flex flex-col p-5 space-y-4 animate-scaleUp">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-16 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent pointer-events-none" />

            <div className="flex items-center gap-2.5 text-status-warning relative">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
              </div>
              <h3 className="text-sm font-bold text-text-primary">
                {statusCandidate.status === "ACTIVE" ? "Deactivate Staff Account?" : "Activate Staff Account?"}
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed relative">
              Are you sure you want to{" "}
              {statusCandidate.status === "ACTIVE" ? "deactivate" : "reactivate"}{" "}
              <strong className="text-text-primary">{statusCandidate.fullName}</strong> ({statusCandidate.employeeNumber})?
            </p>

            <p className="text-[11px] text-text-muted leading-relaxed relative">
              {statusCandidate.status === "ACTIVE"
                ? "Deactivating this employee immediately revokes their ability to log in, process sales, or record shift attendance. Historical audit data remains intact."
                : "Activating this employee allows them to resume logging in and processing transactions at their assigned branch."}
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/60 relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusCandidate(null)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isSubmittingStatus}
                onClick={() => handleToggleStatus(statusCandidate)}
                className={`text-xs font-semibold rounded-lg px-3.5 ${
                  statusCandidate.status === "ACTIVE"
                    ? "bg-status-danger hover:bg-status-danger/90 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {isSubmittingStatus
                  ? "Updating..."
                  : statusCandidate.status === "ACTIVE"
                  ? "Deactivate Account"
                  : "Activate Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
