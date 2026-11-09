// src/lib/drako/server.ts

const DRAKO_SUPPLIER_CODE =
  process.env.DRAKO_SUPPLIER_CODE ?? "";

export function isDrakoSupplier(code?: string | null) {
  return (
    !!code &&
    code.trim().toUpperCase() ===
      DRAKO_SUPPLIER_CODE.trim().toUpperCase()
  );
}