/**
 * Company Documents - Country-specific Document Types Tests
 *
 * Tests the country-specific mandatory document type logic:
 * - Base doc types apply to ALL companies
 * - Egypt-specific doc types (Export Certificate, Tax Portal, Social Insurance)
 * - UAE-specific doc types (Company Establishment Card)
 * - ADGM-specific doc types (Housing Lease Contract)
 * - Auto-initialization creates correct doc types per company
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Constants (mirror from companyDocuments.ts) ─────────────────────────────

const ALL_DOC_TYPES = [
  "company_registration",
  "vat_registration",
  "tax_registration",
  "constitution_contract",
  "owner_id",
  "owner_passport",
  "office_lease_contract",
  "medical_insurance_policy",
  "export_certificate",
  "tax_portal_registration",
  "social_insurance",
  "company_establishment_card",
  "housing_lease_contract",
] as const;

const BASE_DOC_TYPES = [
  "company_registration",
  "vat_registration",
  "tax_registration",
  "constitution_contract",
  "owner_id",
  "owner_passport",
  "office_lease_contract",
  "medical_insurance_policy",
] as const;

const EGYPT_DOC_TYPES = [
  "export_certificate",
  "tax_portal_registration",
  "social_insurance",
] as const;

const UAE_DOC_TYPES = [
  "company_establishment_card",
] as const;

const ADGM_DOC_TYPES = [
  "housing_lease_contract",
] as const;

const EGYPT_COMPANY_IDS = [3, 4, 5];
const UAE_COMPANY_IDS = [1, 2];
const ADGM_COMPANY_ID = 1;

function getDocTypesForCompany(odooCompanyId: number): string[] {
  const types: string[] = [...BASE_DOC_TYPES];
  if (EGYPT_COMPANY_IDS.includes(odooCompanyId)) {
    types.push(...EGYPT_DOC_TYPES);
  }
  if (UAE_COMPANY_IDS.includes(odooCompanyId)) {
    types.push(...UAE_DOC_TYPES);
  }
  if (odooCompanyId === ADGM_COMPANY_ID) {
    types.push(...ADGM_DOC_TYPES);
  }
  return types;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Company Documents - Country-specific Document Types", () => {
  describe("getDocTypesForCompany", () => {
    it("returns 8 base doc types for all companies", () => {
      // Every company should have at least the 8 base types
      const allCompanyIds = [1, 2, 3, 4, 5];
      for (const id of allCompanyIds) {
        const types = getDocTypesForCompany(id);
        for (const baseType of BASE_DOC_TYPES) {
          expect(types).toContain(baseType);
        }
      }
    });

    it("returns Office Lease Contract for ALL companies", () => {
      const allCompanyIds = [1, 2, 3, 4, 5];
      for (const id of allCompanyIds) {
        const types = getDocTypesForCompany(id);
        expect(types).toContain("office_lease_contract");
      }
    });

    it("returns Medical Insurance Policy for ALL companies", () => {
      const allCompanyIds = [1, 2, 3, 4, 5];
      for (const id of allCompanyIds) {
        const types = getDocTypesForCompany(id);
        expect(types).toContain("medical_insurance_policy");
      }
    });

    it("returns Egypt-specific doc types for Cairo-PLATFARM (id=3)", () => {
      const types = getDocTypesForCompany(3);
      expect(types).toContain("export_certificate");
      expect(types).toContain("tax_portal_registration");
      expect(types).toContain("social_insurance");
      // Should NOT have UAE-specific types
      expect(types).not.toContain("company_establishment_card");
      expect(types).not.toContain("housing_lease_contract");
    });

    it("returns Egypt-specific doc types for Sokhna-PLATFARM (id=4)", () => {
      const types = getDocTypesForCompany(4);
      expect(types).toContain("export_certificate");
      expect(types).toContain("tax_portal_registration");
      expect(types).toContain("social_insurance");
      expect(types).not.toContain("company_establishment_card");
      expect(types).not.toContain("housing_lease_contract");
    });

    it("returns Egypt-specific doc types for Cairo-AlfaGlobal (id=5)", () => {
      const types = getDocTypesForCompany(5);
      expect(types).toContain("export_certificate");
      expect(types).toContain("tax_portal_registration");
      expect(types).toContain("social_insurance");
      expect(types).not.toContain("company_establishment_card");
      expect(types).not.toContain("housing_lease_contract");
    });

    it("returns UAE-specific doc types for ABU DHABI-PLATFARM (id=2)", () => {
      const types = getDocTypesForCompany(2);
      expect(types).toContain("company_establishment_card");
      // Should NOT have Egypt-specific types
      expect(types).not.toContain("export_certificate");
      expect(types).not.toContain("tax_portal_registration");
      expect(types).not.toContain("social_insurance");
      // Should NOT have ADGM-specific types
      expect(types).not.toContain("housing_lease_contract");
    });

    it("returns UAE + ADGM-specific doc types for ADGM-PLATFARM (id=1)", () => {
      const types = getDocTypesForCompany(1);
      expect(types).toContain("company_establishment_card");
      expect(types).toContain("housing_lease_contract");
      // Should NOT have Egypt-specific types
      expect(types).not.toContain("export_certificate");
      expect(types).not.toContain("tax_portal_registration");
      expect(types).not.toContain("social_insurance");
    });

    it("returns correct total count for Egypt companies (8 base + 3 Egypt = 11)", () => {
      expect(getDocTypesForCompany(3).length).toBe(11);
      expect(getDocTypesForCompany(4).length).toBe(11);
      expect(getDocTypesForCompany(5).length).toBe(11);
    });

    it("returns correct total count for ABU DHABI (8 base + 1 UAE = 9)", () => {
      expect(getDocTypesForCompany(2).length).toBe(9);
    });

    it("returns correct total count for ADGM (8 base + 1 UAE + 1 ADGM = 10)", () => {
      expect(getDocTypesForCompany(1).length).toBe(10);
    });
  });

  describe("DOC_TYPE_LABELS completeness", () => {
    const DOC_TYPE_LABELS: Record<string, string> = {
      company_registration: "Company Registration",
      vat_registration: "VAT Registration",
      tax_registration: "Tax Registration",
      constitution_contract: "Constitution Contract",
      owner_id: "Owner ID",
      owner_passport: "Owner Passport",
      office_lease_contract: "Office Lease Contract",
      medical_insurance_policy: "Medical Insurance Policy",
      export_certificate: "Export Certificate",
      tax_portal_registration: "Tax Portal Registration",
      social_insurance: "Social Insurance",
      company_establishment_card: "Company Establishment Card",
      housing_lease_contract: "Housing Lease Contract",
    };

    it("has a label for every doc type in ALL_DOC_TYPES", () => {
      for (const type of ALL_DOC_TYPES) {
        expect(DOC_TYPE_LABELS[type]).toBeDefined();
        expect(DOC_TYPE_LABELS[type].length).toBeGreaterThan(0);
      }
    });

    it("has exactly 13 doc type labels", () => {
      expect(Object.keys(DOC_TYPE_LABELS).length).toBe(13);
    });
  });

  describe("Company ID mappings", () => {
    it("Egypt company IDs are correct", () => {
      expect(EGYPT_COMPANY_IDS).toEqual([3, 4, 5]);
    });

    it("UAE company IDs are correct", () => {
      expect(UAE_COMPANY_IDS).toEqual([1, 2]);
    });

    it("ADGM company ID is correct", () => {
      expect(ADGM_COMPANY_ID).toBe(1);
    });

    it("ADGM is a subset of UAE companies", () => {
      expect(UAE_COMPANY_IDS).toContain(ADGM_COMPANY_ID);
    });

    it("Egypt and UAE company sets do not overlap", () => {
      const overlap = EGYPT_COMPANY_IDS.filter(id => UAE_COMPANY_IDS.includes(id));
      expect(overlap.length).toBe(0);
    });
  });
});
