import { PartnerWorkspace } from "@/components/partners/partner-workspace";

export default async function PartnerPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  return <PartnerWorkspace key={partnerId} partnerId={partnerId} />;
}
