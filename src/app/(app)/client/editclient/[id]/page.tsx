// FILE: src/app/(app)/client/editclient/[id]/page.tsx
import EditClient from "../../EditClient";

export default function ClientEditPage({ params }: { params: { id: string } }) {
  return <EditClient clientId={params.id} />;
}
