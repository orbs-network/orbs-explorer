import { useNetwork } from "@/lib/hooks/use-network";
import { useToken } from "@/lib/hooks/use-token";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import { useState } from "react";
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
  const { data: token, isLoading } = useToken(address, chainId);
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);
  const label =
    token?.symbol || (address && !isLoading ? shortenAddress(address) : "...");
  const content = (
    <>
      <Avatar className={cn("", isLogoLoaded ? "w-4.5 h-4.5 mr-2" : "w-0 h-0")}>
        <AvatarImage
          src={token?.logoUrl}
          onLoad={() => setIsLogoLoaded(true)}
        />
        <AvatarFallback />
      </Avatar>
      {label}
    </>
  );

  if (!address || !explorer) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0 text-[13px] font-medium rounded-md",
          className,
        )}
      >
        {content}
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
      {content}
    </Link>
  );
};
