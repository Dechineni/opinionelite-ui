// FILE: src/app/(app)/client/editclient/[id]/page.tsx
import EditClient from "../../EditClient";

type Params = { id: string };

export default async function ClientEditPage(
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  return <EditClient clientId={id} />;
}