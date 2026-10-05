export type CashSessionErrorCode =
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_INACTIVE"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_INACTIVE"
  | "BRANCH_ACCESS_DENIED"
  | "CASH_SESSION_ALREADY_OPEN"
  | "CASH_SESSION_NOT_FOUND"
  | "CASH_SESSION_ALREADY_CLOSED"
  | "INVALID_OPENING_CASH"
  | "INVALID_DECLARED_AMOUNTS"
  | "INSUFFICIENT_DRAWER_CASH"
  | "INVALID_PAYOUT_AMOUNT"
  | "UNAUTHORIZED_SESSION_ACCESS"
  | "PERMISSION_DENIED";

export class CashSessionDomainError extends Error {
  code: CashSessionErrorCode;
  details?: any;

  constructor(message: string, code: CashSessionErrorCode, details?: any) {
    super(message);
    this.name = "CashSessionDomainError";
    this.code = code;
    this.details = details;
  }
}
