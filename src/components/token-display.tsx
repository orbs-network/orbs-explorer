import { useNetwork } from "@/lib/hooks/use-network";
import { useToken } from "@/lib/hooks/use-token";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { shortenAddress } from "@/lib/utils/utils";

export const TokenDisplay = ({
  chainId,
  address,
  className,
}: {
  chainId?: number;
  address?: string;
  className?: string;
}) => {
  const { data: token } = useToken(address, chainId);
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const label =
    token?.symbol || (address ? shortenAddress(address) : "Token unavailable");

  if (!address || !explorer) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0 text-[13px] font-medium rounded-md",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`${explorer}/address/${address}`}
      target="_blank"
      className={cn(
        "inline-flex items-center gap-0 text-[13px] font-medium rounded-md hover:underline",
        className,
      )}
    >
      {label}
    </Link>
  );
};
