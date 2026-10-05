export interface BranchItem {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  openingTime: string;
  closingTime: string;
  gracePeriodMinutes: number;
  activeEmployeesCount: number;
  productsCount: number;
  totalSalesCount: number;
  activeCashDrawersCount: number;
  createdAt: string | Date;
}

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  inventoryUnit: string;
  bulkUnit?: string;
  pieceUnit?: string;
  piecesPerBulk?: number;
  status: "ACTIVE" | "INACTIVE";
  saleItemsCount: number;
  inventoryMovementsCount: number;
  branchProducts: {
    id: string;
    branchId: string;
    branchName: string;
    branchCode: string;
    sellingPrice: string;
    piecePrice?: string | null;
    currentStock: number;
    reorderLevel: number;
  }[];
  createdAt: string | Date;
}

export interface UnitItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  scaleType: "BULK" | "PIECE" | "UNIVERSAL";
  defaultPieceUnit?: string | null;
  defaultRatio?: number | null;
  isDefault: boolean;
  productsCount: number;
  bulkProductsCount?: number;
  pieceProductsCount?: number;
  createdAt: string | Date;
}

export interface EmployeeItem {
  id: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  userStatus: string;
  email: string | null;
  roleId: string | null;
  roleName: string;
  branchId: string | null;
  branchName: string;
  branchCode: string;
  salesCount: number;
  attendancesCount: number;
  isOwner: boolean;
  createdAt: string | Date;
}
