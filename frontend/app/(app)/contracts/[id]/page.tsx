import { notFound } from "next/navigation";

import { ContractDetail } from "@/components/contracts/contract-detail";
import { RequirePermission } from "@/components/forbidden";

export default async function ContractDetailPage(props: PageProps<"/contracts/[id]">) {
  const { id } = await props.params;
  const contractId = Number(id);
  if (!Number.isInteger(contractId) || contractId <= 0) notFound();

  return (
    <RequirePermission permission="contracts:read">
      <ContractDetail contractId={contractId} />
    </RequirePermission>
  );
}
