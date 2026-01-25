import { useCallback } from "react";
import { toast } from "sonner";

export function useCopy() {
  return useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch (err) {
      console.error(err);
    }
  }, []);
}
