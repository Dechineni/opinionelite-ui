// FILE: src/app/(app)/supplier/[id]/edit/page.tsx
export const runtime = 'edge';

import EditSupplier from "@/app/(app)/supplier/EditSupplier";

export default async function SupplierEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;          // ⬅️ important: await the params
  return <EditSupplier supplierId={id} />; // ⬅️ pass supplierId as a prop
}