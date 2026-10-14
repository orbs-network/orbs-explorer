"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { URL_QUERY_KEYS } from "@/lib/consts";
import {
  cn,
  getChains,
  isValidWalletAddress,
  parseAppliedFilters,
} from "@/lib/utils/utils";
import { map, size } from "lodash";
import {
  Check,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  ReactNode,
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  createContext,
  useRef,
  useId,
} from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";
import { PARTNERS } from "@/lib/partners";
import {
  QueryFilterParams,
  useQueryFilterParams,
} from "@/lib/hooks/use-query-filter-params";
import { FilterCombobox, type FilterOption } from "./filter-combobox";
import {
  FILTER_ARRAY_KEYS,
  filterQueryValue,
  splitFilterValues,
} from "@/lib/query-filter-values";
export type { FilterOption } from "./filter-combobox";

type FilterContextType = {
  onUpdate: (key: string, value: string[] | string | undefined) => void;
  onSubmit: () => boolean;
  registerValidation: (key: string, validate: () => boolean) => () => void;
  data: QueryFilterParams;
};

const Context = createContext<FilterContextType>({} as FilterContextType);

const FilterContextProvider = ({ children }: { children: ReactNode }) => {
  const { setQuery, query } = useQueryFilterParams();
  return (
    <FilterDraft key={JSON.stringify(query)} query={query} setQuery={setQuery}>
      {children}
    </FilterDraft>
  );
};

const FilterDraft = ({
  children,
  query,
  setQuery,
}: {
  children: ReactNode;
  query: QueryFilterParams;
  setQuery: ReturnType<typeof useQueryFilterParams>["setQuery"];
}) => {
  const [data, setData] = useState(query);
  const dataRef = useRef(query);
  const validations = useRef(new Map<string, () => boolean>());
  const registerValidation = useCallback(
    (key: string, validate: () => boolean) => {
      validations.current.set(key, validate);
      return () => {
        validations.current.delete(key);
      };
    },
    [],
  );

  const onUpdate = useCallback(
    (queryKey: string, value?: string | string[]) => {
      const next = { ...dataRef.current, [queryKey]: value };
      dataRef.current = next;
      setData(next);
    },
    [],
  );

  const onSubmit = useCallback(() => {
    for (const validate of validations.current.values()) {
      if (!validate()) return false;
    }
    setQuery.updateQuery(
      dataRef.current as Record<
        string,
        string | number | (string | number)[] | undefined
      >,
    );
    return true;
  }, [setQuery]);

  return (
    <Context.Provider value={{ onUpdate, onSubmit, registerValidation, data }}>
      {children}
    </Context.Provider>
  );
};

const useFilterContext = () => {
  return useContext(Context);
};

const useFilterData = (queryKey: string) => {
  const { data } = useFilterContext();

  return useMemo(() => {
    const value = data?.[queryKey as keyof typeof data] || [];
    return Array.isArray(value) ? value : [value];
  }, [data, queryKey]);
};

type OptionsFilterProps = {
  label: string;
  queryKey: string;
  options: FilterOption[];
  placeholder?: string;
};

const OptionsFilter = ({
  queryKey,
  mode,
  ...props
}: OptionsFilterProps & { mode: "single" | "multiple" }) => {
  const { onUpdate } = useFilterContext();
  const data = useFilterData(queryKey);
  return (
    <FilterCombobox
      {...props}
      mode={mode}
      value={data}
      onChange={(values) =>
        onUpdate(queryKey, filterQueryValue(queryKey, values))
      }
    />
  );
};
const SelectFilter = (props: OptionsFilterProps) => (
  <OptionsFilter {...props} mode="single" />
);
const MultiSelectFilter = (props: OptionsFilterProps) => (
  <OptionsFilter {...props} mode="multiple" />
);

const FilterSection = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {children}
    </div>
  );
};

const FilterHeader = ({
  label,
  onReset,
  showReset = false,
  controlId,
}: {
  label: string;
  onReset: () => void;
  showReset?: boolean;
  controlId?: string;
}) => {
  return (
    <div className="flex items-center gap-2 w-full justify-between">
      <label
        htmlFor={controlId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {showReset && (
        <button
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          onClick={onReset}
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
      )}
    </div>
  );
};

const acceptFilterValue = () => true;
const ValuesFilter = ({
  label,
  queryKey,
  placeholder,
  className,
  inputType = "text",
  validateValue = acceptFilterValue,
}: {
  label: string;
  queryKey: string;
  placeholder: string;
  className?: string;
  inputType?: "text" | "number";
  validateValue?: (value: string) => boolean;
}) => {
  const { onUpdate, registerValidation } = useFilterContext();
  const data = useFilterData(queryKey);
  const multiple = FILTER_ARRAY_KEYS.has(queryKey);
  const [text, setText] = useState(() => data.join(", "));
  const textRef = useRef(text);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [error, setError] = useState("");
  const validate = useCallback(
    (focus = false) => {
      const values = multiple
        ? splitFilterValues(textRef.current)
        : [textRef.current.trim()].filter(Boolean);
      const invalid = values.some((value) => !validateValue(value));
      setError(
        invalid
          ? `Enter a valid ${queryKey === URL_QUERY_KEYS.USER ? "wallet address" : label.toLowerCase()}.`
          : "",
      );
      if (invalid && focus) inputRef.current?.focus();
      return !invalid;
    },
    [multiple, validateValue, label, queryKey],
  );
  useEffect(
    () => registerValidation(queryKey, () => validate(true)),
    [registerValidation, queryKey, validate],
  );
  const update = (value: string) => {
    textRef.current = value;
    setText(value);
    setError("");
    onUpdate(
      queryKey,
      filterQueryValue(
        queryKey,
        multiple ? splitFilterValues(value) : [value.trim()],
      ),
    );
  };
  return (
    <FilterSection className={className}>
      <FilterHeader
        label={label}
        controlId={id}
        onReset={() => update("")}
        showReset={Boolean(text)}
      />
      <Input
        id={id}
        ref={inputRef}
        type={inputType}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={text}
        onChange={(event) => update(event.target.value)}
        onBlur={() => validate()}
        aria-invalid={Boolean(error)}
        aria-describedby={error || multiple ? `${id}-help` : undefined}
        className="h-10 placeholder:text-muted-foreground"
      />
      {(error || multiple) && (
        <p
          id={`${id}-help`}
          role={error ? "alert" : undefined}
          className={cn(
            "text-xs",
            error ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {error || "Separate multiple values with commas."}
        </p>
      )}
    </FilterSection>
  );
};

const TokensFilter = () => {
  return (
    <>
      <ValuesFilter
        className="flex-1"
        queryKey={URL_QUERY_KEYS.IN_TOKEN}
        label="Token to trade"
        placeholder="Token address…"
      />
      <ValuesFilter
        className="flex-1"
        queryKey={URL_QUERY_KEYS.OUT_TOKEN}
        label="Token to receive"
        placeholder="Token address…"
      />
    </>
  );
};

const ChainsFilter = () => {
  const options = useMemo(() => {
    return getChains().map((chain) => ({
      label: chain.name,
      value: chain.id.toString(),
      logo: chain.logoUrl,
    }));
  }, []);

  return (
    <SelectFilter
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Networks"
      options={options}
    />
  );
};

const PartnersFilter = () => {
  const options = useMemo(() => {
    return map(PARTNERS, (partner) => ({
      label: partner.name,
      value: partner.id,
      logo: partner.logo,
    }));
  }, []);

  return (
    <SelectFilter
      queryKey={URL_QUERY_KEYS.PARTNER_ID}
      label="Trading apps"
      options={options}
    />
  );
};

const UserFilter = () => {
  return (
    <ValuesFilter
      queryKey={URL_QUERY_KEYS.USER}
      label="Wallet addresses"
      placeholder="0x…"
      validateValue={(value) => isValidWalletAddress(value)}
    />
  );
};

const FilterModalButtons = ({ onClose }: { onClose: () => void }) => {
  const { onSubmit } = useFilterContext();
  const { setQuery, query } = useQueryFilterParams();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-2 cursor-pointer"
        onClick={() => {
          setQuery.updateQuery(
            Object.fromEntries(
              Object.keys(query).map((key) => [key, undefined]),
            ),
          );
          onClose();
        }}
      >
        <RotateCcw className="w-4 h-4" />
        Reset All
      </Button>
      <Button
        type="button"
        variant="default"
        className="flex-1 gap-2 cursor-pointer"
        onClick={() => {
          if (onSubmit()) onClose();
        }}
      >
        <Check className="w-4 h-4" />
        Apply Filters
      </Button>
    </div>
  );
};

const InputFilter = ({
  label,
  placeholder,
  queryKey,
}: {
  placeholder: string;
  queryKey: string;
  label: string;
}) => {
  const id = useId();
  const data = useFilterData(queryKey)[0];
  const { onUpdate } = useFilterContext();

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        controlId={id}
        onReset={() => onUpdate(queryKey, undefined)}
        showReset={!!data}
      />
      <Input
        id={id}
        className="h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground"
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => onUpdate(queryKey, e.target.value)}
        value={data || ""}
      />
    </FilterSection>
  );
};

function parseTimestampFilter(value?: string) {
  if (!value) return {};
  const [from, to] = value.split("-");
  const fromMs = Number(from);
  const toMs = Number(to);
  return {
    from: Number.isFinite(fromMs) && from ? fromMs : undefined,
    to: Number.isFinite(toMs) && to ? toMs : undefined,
  };
}

function toDatetimeLocal(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function serializeTimestampFilter(from?: number, to?: number) {
  if (!from && !to) return undefined;
  return `${from ?? ""}-${to ?? ""}`;
}

const TimestampRangeFilter = ({
  label = "Timestamp",
  queryKey = URL_QUERY_KEYS.TIMESTAMP,
}: {
  label?: string;
  queryKey?: string;
}) => {
  const rawValue = useFilterData(queryKey)[0];
  const { onUpdate } = useFilterContext();
  const { from, to } = useMemo(
    () => parseTimestampFilter(rawValue),
    [rawValue],
  );

  const updateFrom = useCallback(
    (value: string) => {
      onUpdate(
        queryKey,
        serializeTimestampFilter(fromDatetimeLocal(value), to),
      );
    },
    [onUpdate, queryKey, to],
  );

  const updateTo = useCallback(
    (value: string) => {
      onUpdate(
        queryKey,
        serializeTimestampFilter(from, fromDatetimeLocal(value)),
      );
    },
    [from, onUpdate, queryKey],
  );

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        onReset={() => onUpdate(queryKey, undefined)}
        showReset={Boolean(rawValue)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          type="datetime-local"
          aria-label={`${label} from`}
          value={toDatetimeLocal(from)}
          onChange={(event) => updateFrom(event.target.value)}
          className="h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
        />
        <Input
          type="datetime-local"
          aria-label={`${label} to`}
          value={toDatetimeLocal(to)}
          onChange={(event) => updateTo(event.target.value)}
          className="h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
        />
      </div>
    </FilterSection>
  );
};

const MinDollarValueFilter = () => {
  return (
    <InputFilter
      placeholder="e.g. 100"
      queryKey={URL_QUERY_KEYS.MIN_DOLLAR_VALUE}
      label="Minimum value (USD)"
    />
  );
};

const FiltersTrigger = ({ countKeys }: { countKeys?: string[] }) => {
  const { query } = useQueryFilterParams();
  const filtersCount = useMemo(() => {
    if (countKeys?.length) {
      return size(
        countKeys
          .flatMap((key) => query[key as keyof typeof query] ?? [])
          .filter(Boolean),
      );
    }
    const { [URL_QUERY_KEYS.TIMESTAMP]: timestamp, ...rest } = query;
    return size(Object.values(rest).flat().filter(Boolean));
  }, [countKeys, query]);

  return (
    <DrawerTrigger asChild>
      <Button variant="outline" className="gap-2" aria-label="Filters">
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Filters</span>
        {filtersCount > 0 && (
          <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
            {filtersCount}
          </span>
        )}
      </Button>
    </DrawerTrigger>
  );
};

export const QueryFilters = ({
  children,
  countKeys,
  filters,
}: {
  children?: ReactNode;
  countKeys?: string[];
  filters?: {
    userFilter?: boolean;
    minDollarValueFilter?: boolean;
    chainIdFilter?: boolean;
    partnerIdFilter?: boolean;
    tokensFilter?: boolean;
  };
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Drawer direction="right" open={open} onOpenChange={setOpen}>
      <FiltersTrigger countKeys={countKeys} />
      <DrawerContent
        className="fixed right-0 top-0 h-full bg-card border-l border-border outline-none flex flex-col data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-[420px]"
        onEscapeKeyDown={(event) => {
          const target = event.target;
          if (
            target instanceof HTMLElement &&
            target.getAttribute("role") === "combobox" &&
            target.getAttribute("aria-expanded") === "true"
          )
            event.preventDefault();
        }}
      >
        <FilterContextProvider>
          <DrawerHeader className="border-b border-border pb-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                </div>
                <DrawerTitle className="text-lg font-semibold text-foreground">
                  Filters
                </DrawerTitle>
              </div>
              <DrawerClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div data-filter-scroll className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
              {children}
              <>
                {filters?.userFilter && <UserFilter />}
                {filters?.minDollarValueFilter && <MinDollarValueFilter />}
                {filters?.chainIdFilter && <ChainsFilter />}
                {filters?.partnerIdFilter && <PartnersFilter />}
                {filters?.tokensFilter && <TokensFilter />}
              </>
            </div>
          </div>

          <div className="shrink-0 p-4 border-t border-border bg-card">
            <FilterModalButtons onClose={() => setOpen(false)} />
          </div>
        </FilterContextProvider>
      </DrawerContent>
    </Drawer>
  );
};

const ActiveFilterBadge = ({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) => {
  return (
    <button
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-link border border-primary/20 hover:bg-primary/20 transition-colors group cursor-pointer"
      onClick={onClick}
    >
      <span>{text}</span>
      <X className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
    </button>
  );
};

function ActiveQueryFilters() {
  const { query, setQuery } = useQueryFilterParams();

  const onRemove = (key: string, value: string) => {
    const data = query[key as keyof typeof query];

    setQuery.updateQuery({
      ...query,
      [key]: Array.isArray(data)
        ? data.filter((it) => it !== value)
        : undefined,
    });
  };

  const appliedFilters = useMemo(() => parseAppliedFilters(query), [query]);
  const hasFilters = appliedFilters.length > 0;

  if (!hasFilters) return null;

  return (
    <div className="flex flex-col gap-3 w-full bg-muted/30 rounded-xl border border-border p-4 mb-4">
      <div className="flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Active Filters
          </span>
        </div>
        <button
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          onClick={() =>
            setQuery.updateQuery(
              Object.fromEntries(
                Object.keys(query).map((key) => [key, undefined]),
              ),
            )
          }
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {map(appliedFilters, (item) => {
          if (typeof item.value === "string") {
            return (
              <ActiveFilterBadge
                key={item.key}
                text={`${item.name}: ${item.value}`}
                onClick={() => onRemove(item.key, item.value as string)}
              />
            );
          }
          if (Array.isArray(item.value)) {
            return item.value.map((value) => (
              <ActiveFilterBadge
                key={`${item.key}-${value}`}
                text={`${item.name}: ${value}`}
                onClick={() => onRemove(item.key, value)}
              />
            ));
          }
          return null;
        })}
      </div>
    </div>
  );
}

QueryFilters.Select = SelectFilter;
QueryFilters.MultiSelect = MultiSelectFilter;
QueryFilters.Values = ValuesFilter;
QueryFilters.Input = InputFilter;
QueryFilters.Timestamp = TimestampRangeFilter;
QueryFilters.Active = ActiveQueryFilters;
