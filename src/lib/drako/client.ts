// src/lib/drako/client.ts

const DRAKO_SUPPLIER_CODE =
  process.env.NEXT_PUBLIC_DRAKO_SUPPLIER_CODE ?? "";

export function isDrakoSupplier(code?: string | null) {
  return (
    !!code &&
    code.trim().toUpperCase() ===
      DRAKO_SUPPLIER_CODE.trim().toUpperCase()
  );
}
