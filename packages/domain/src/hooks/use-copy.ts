import { useCallback } from "react";
import { toast } from "sonner";

export function useCopy() {
  return useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn’t copy. Select the value and copy it manually.");
    }
  }, []);
}
