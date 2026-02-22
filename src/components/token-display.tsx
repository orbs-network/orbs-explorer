import { useNetwork } from "@/lib/hooks/use-network";
import { useToken } from "@/lib/hooks/use-token";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";

export const TokenDisplay = ({
  chainId,
  address,
}: {
  chainId?: number;
  address?: string;
}) => {
  const token = useToken(address, chainId).data;
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;

  return (
    <Link
      href={`${explorer}/address/${address}`}
      target="_blank"
      className="inline-flex items-center gap-2 px-2 py-1 bg-primary/10 text-primary text-[13px] font-medium rounded-md hover:bg-primary/20 transition-colors"
    >
      <Avatar className="w-5 h-5">
        <AvatarImage src={token?.logoUrl} />
        <AvatarFallback></AvatarFallback>
      </Avatar>
      {token?.symbol || "..."}
    </Link>
  );
};
