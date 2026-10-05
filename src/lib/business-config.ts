/**
 * Central Business Profile & Dynamic Invoice Configuration
 * Provides authoritative company details, legal registration, bank remittance details,
 * and smart fallbacks for branch and invoice generation.
 */

export interface BusinessConfig {
  legalName: string;
  tradingName: string;
  tagline: string;
  registrationNumber: string; // CAC / RC Number
  taxId: string; // TIN
  headOfficeAddress: string;
  supportPhone: string;
  supportEmail: string;
  website: string;
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    instructions: string;
  };
  invoiceTerms: string;
}

export const defaultBusinessConfig: BusinessConfig = {
  legalName: "FrankLucy Commercial Enterprises Ltd",
  tradingName: "FrankLucy Commercial Operations",
  tagline: "Wholesale & Retail Beverage & Commercial Distribution",
  registrationNumber: "RC-1849201",
  taxId: "TIN-9823410-0001",
  headOfficeAddress: "14 Commercial Avenue, Ikeja, Lagos State, Nigeria",
  supportPhone: "+234 802 000 1122",
  supportEmail: "billing@franklucy.com",
  website: "www.franklucy.com",
  bankDetails: {
    bankName: "Zenith Bank PLC",
    accountNumber: "1012345678",
    accountName: "FrankLucy Commercial Enterprises Ltd",
    instructions: "Please include invoice number as payment narration/reference.",
  },
  invoiceTerms:
    "Goods received in good order. Outstanding balances must be settled within the agreed timeline. Unpaid inventory remains the legal property of FrankLucy until full settlement.",
};

export interface ResolvedBranchInvoiceConfig {
  businessName: string;
  tradingName: string;
  tagline: string;
  registrationNumber: string;
  taxId: string;
  branchName: string;
  branchCode: string;
  branchAddress: string;
  branchPhone: string;
  supportEmail: string;
  bankDetails: BusinessConfig["bankDetails"];
  invoiceTerms: string;
}

export function getBranchInvoiceConfig(branch?: {
  name?: string;
  code?: string;
  address?: string | null;
  phone?: string | null;
}): ResolvedBranchInvoiceConfig {
  return {
    businessName: defaultBusinessConfig.legalName,
    tradingName: defaultBusinessConfig.tradingName,
    tagline: defaultBusinessConfig.tagline,
    registrationNumber: defaultBusinessConfig.registrationNumber,
    taxId: defaultBusinessConfig.taxId,
    branchName: branch?.name || "Main Branch",
    branchCode: branch?.code || "HQ",
    branchAddress:
      branch?.address || defaultBusinessConfig.headOfficeAddress,
    branchPhone: branch?.phone || defaultBusinessConfig.supportPhone,
    supportEmail: defaultBusinessConfig.supportEmail,
    bankDetails: defaultBusinessConfig.bankDetails,
    invoiceTerms: defaultBusinessConfig.invoiceTerms,
  };
}
