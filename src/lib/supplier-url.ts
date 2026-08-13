export type SupplierUrlOptions = {
  uiBase: string;
  projectCode: string;
  supplierCode: string;
  projectType: string;
};

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

  let url =
    `${ui}/Survey?projectId=${projectCode}` +
    `&supplierId=${supplierCode}` +
    `&id=[identifier]`;

  if ((opts.projectType || "").trim() === "Recontact") {
    url = appendRecidIfNeeded(url);
  }

  return url;
}
