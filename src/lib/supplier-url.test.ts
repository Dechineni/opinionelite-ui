// File: src/lib/supplier-url.test.ts
import { describe, expect, it } from "vitest";
import { buildSupplierUrl, appendRecidIfNeeded } from "./supplier-url";

describe("buildSupplierUrl", () => {
  it("builds exact Adhocs supplier URL", () => {
  const url = buildSupplierUrl({
    uiBase: "https://test.com",
    projectCode: "SR123",
    supplierCode: "S111",
    projectType: "Adhocs",
  });

  expect(url).toBe(
    "https://test.com/Survey?projectId=SR123&supplierId=S111&id=[identifier]"
  );
});

it("builds exact Recontact supplier URL", () => {
  const url = buildSupplierUrl({
    uiBase: "https://test.com",
    projectCode: "SR123",
    supplierCode: "S111",
    projectType: "Recontact",
  });

  expect(url).toBe(
    "https://test.com/Survey?projectId=SR123&supplierId=S111&id=[identifier]&recid=[recid]"
  );
});

  it("does not append duplicate recid", () => {
    const url =
      "https://test.com/Survey?projectId=SR123" +
      "&supplierId=S111&id=[identifier]&recid=[recid]";

    const result = appendRecidIfNeeded(url);

    expect(result.match(/recid=/g)?.length).toBe(1);
  });

  it("contains supplierId", () => {
    const url = buildSupplierUrl({
      uiBase: "https://test.com",
      projectCode: "SR123",
      supplierCode: "S111",
      projectType: "Adhocs",
    });

    expect(url).toContain("supplierId=S111");
  });

  it("contains projectId", () => {
    const url = buildSupplierUrl({
      uiBase: "https://test.com",
      projectCode: "SR123",
      supplierCode: "S111",
      projectType: "Adhocs",
    });

    expect(url).toContain("projectId=SR123");
  });

  it("contains identifier token", () => {
    const url = buildSupplierUrl({
      uiBase: "https://test.com",
      projectCode: "SR123",
      supplierCode: "S111",
      projectType: "Adhocs",
    });

    expect(url).toContain("[identifier]");
  });
});
