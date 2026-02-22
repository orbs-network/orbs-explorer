import { useNetwork } from "@/lib/hooks/use-network";
import { useToken } from "@/lib/hooks/use-token";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const TokenDisplay = ({
  chainId,
  address,
  className,
}: {
  chainId?: number;
  address?: string;
  className?: string;
}) => {
  const token = useToken(address, chainId).data;
  const explorer = useNetwork(chainId)?.blockExplorers?.default.url;
  const [isLogoLoaded, setIsLogoLoaded] = useState(false);

  return (
    <Link
      href={`${explorer}/address/${address}`}
      target="_blank"
      className={cn("inline-flex items-center gap-0 px-2 py-1 bg-primary/10 text-primary text-[13px] font-medium rounded-md hover:bg-primary/20 transition-colors", className)}
    >
      <Avatar className={cn("", isLogoLoaded ? "w-5 h-5 mr-2" : "w-0 h-0")}>
        <AvatarImage
          src={token?.logoUrl}
          onLoad={() => setIsLogoLoaded(true)}
        />
        <AvatarFallback />
      </Avatar>
      {token?.symbol || "..."}
    </Link>
  );
};
