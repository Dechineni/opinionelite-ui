// File: src/lib/supplier-url.ts
export type SupplierUrlOptions = {
  uiBase: string;
  projectCode: string;
  supplierCode: string;
  projectType: string;
};

 // FOR RECONTACT PROJECTS, APPEND RECID PARAMETER TO THE URL
export function appendRecidIfNeeded(url: string) {
  if (url.includes("recid=")) {
    return url;
  }

  return `${url}&recid=[recid]`;
}

export function buildSupplierUrl(opts: SupplierUrlOptions) {
  const ui = (opts.uiBase || "").replace(/\/+$/, "");
  const projectCode = encodeURIComponent(opts.projectCode || "");
  const supplierCode = encodeURIComponent(opts.supplierCode || "");

  // GENERATE THE BASE SUPPLIER MAPPING URL
  let url =
    `${ui}/Survey?projectId=${projectCode}` +
    `&supplierId=${supplierCode}` +
    `&id=[identifier]`;

 // GET PROJECT TYPE AND REMOVE ANY LEADING/TRAILING SPACES
  if ((opts.projectType || "").trim() === "Recontact") {
    url = appendRecidIfNeeded(url);
  }
 // RETURN THE GENERATED SUPPLIER URL
  return url;
}
