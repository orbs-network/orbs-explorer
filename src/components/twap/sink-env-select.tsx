"use client";

import { URL_QUERY_KEYS } from "@/lib/consts";
import { useQueryFilterParams } from "@/lib/hooks/use-query-filter-params";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ENV_OPTIONS = [
  { value: "prod", label: "Prod" },
  { value: "dev", label: "Dev" },
] as const;

export function TwapSinkEnvSelect() {
  const { query, setQuery } = useQueryFilterParams();
  const value = query[URL_QUERY_KEYS.TWAP_SINK_ENV] === "dev" ? "dev" : "prod";

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        setQuery.updateQuery({
          ...query,
          [URL_QUERY_KEYS.TWAP_SINK_ENV]: v === "prod" ? undefined : v,
        });
      }}
    >
      <SelectTrigger className="w-[7rem]" aria-label="API environment">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ENV_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
