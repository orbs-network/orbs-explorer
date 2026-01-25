"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { useAppSearch } from "@/lib/hooks/use-app-search";
import { Spinner } from "./ui/spinner";

export function SearchInput({
  className = "",
  placeholder = "Enter Tx Hash",
  onSubmit,
}: {
  className?: string;
  placeholder?: string;
  onSubmit?: (value: string) => void;
}) {
  const [value, setVale] = useState("");
  const { mutate: search, isPending } = useAppSearch();


  const onSearch = useCallback(() => {
    if (!value) return;
    try {
      onSubmit ? onSubmit(value) : search(value);
    } catch (error) {
      toast.error("Invalid input", {
        description: (error as Error).message,
      });
    }
  }, [value, search]);

  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === "Enter") {
        onSearch();
      }
    },
    [onSearch]
  );

  return (
    <>
      <div
        className={`bg-accent rounded-lg p-1 w-full flex flex-row gap-2 items-center h-[45px] text-[16px] ${className}`}
      >
        <Input
          placeholder={placeholder}
          value={value}
          onKeyDown={onKeyDown}
          onChange={(e: any) => setVale(e.target.value)}
          className="outline-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:placeholder:text-transparent font-mono placeholder:text-muted-foreground md:text-[16px] bg-transparent"
        />
        <button
          disabled={!value}
          onClick={onSearch}
          className="outline-none border-none bg-slate-500/50 rounded-lg hover:bg-slate-500/70 transition-all duration-300 flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-[40px] h-[33px]"
        >
          {isPending ? <Spinner size={16} /> : <ArrowUp size={16} color="white" />}
        </button>
      </div>
    </>
  );
}
