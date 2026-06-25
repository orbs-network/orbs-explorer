/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { URL_QUERY_KEYS } from "@/lib/consts";
import {
  cn,
  getChains,
  isValidWalletAddress,
  parseAppliedFilters,
  shortenAddress,
} from "@/lib/utils/utils";
import { map, size } from "lodash";
import {
  Check,
  ChevronRight,
  Filter,
  Link2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  User,
  Wallet,
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
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";

export type FilterOption = {
  label: string;
  value: string;
  logo?: string;
};

type FilterContextType = {
  onUpdate: (key: string, value: string[] | string | undefined) => void;
  onSubmit: () => void;
  data: QueryFilterParams;
};

const Context = createContext<FilterContextType>({} as FilterContextType);

const FilterContextProvider = ({ children }: { children: ReactNode }) => {
  const { setQuery, query } = useQueryFilterParams();
  const [data, setData] = useState({} as QueryFilterParams);
  const dataRef = useRef({} as QueryFilterParams);

  const onUpdate = useCallback(
    (queryKey: string, value?: string | string[]) => {
      const next = { ...dataRef.current, [queryKey]: value };
      dataRef.current = next;
      setData(next);
    },
    [],
  );

  const onSubmit = useCallback(() => {
    setQuery.updateQuery(
      dataRef.current as Record<
        string,
        string | number | (string | number)[] | undefined
      >,
    );
  }, [setQuery]);

  useEffect(() => {
    setData(query);
    dataRef.current = query;
  }, [query]);

  return (
    <Context.Provider value={{ onUpdate, onSubmit, data }}>
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

const BadgesFilter = ({
  label,
  queryKey,
  options,
  singleSelect = false,
}: {
  label: string;
  queryKey: string;
  options: FilterOption[];
  singleSelect?: boolean;
}) => {
  const { onUpdate } = useFilterContext();
  const data = useFilterData(queryKey);

  const onSelect = useCallback(
    (option: FilterOption) => {
      if (singleSelect) {
        onUpdate(queryKey, [option.value]);
        return;
      }
      const newData = data?.includes(option.value)
        ? data.filter((it) => it !== option.value)
        : [...(data || []), option.value];
      onUpdate(queryKey, newData);
    },
    [data, onUpdate, queryKey, singleSelect],
  );

  const onReset = useCallback(() => {
    onUpdate(queryKey, []);
  }, [onUpdate, queryKey]);

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        onReset={onReset}
        showReset={Boolean(data?.length)}
      />
      <FilterBadgesContainer>
        {options.map((option) => {
          const selected = data?.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                "border gap-2",
                selected
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border",
              )}
            >
              <span className="text-sm font-medium capitalize">
                {option.label}
              </span>
              {option.logo && (
                <Avatar className="w-4 h-4">
                  <AvatarImage src={option.logo} />
                  <AvatarFallback>{option.label.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </button>
          );
        })}
      </FilterBadgesContainer>
    </FilterSection>
  );
};

const SingleValueBadgesFilter = ({
  label,
  queryKey,
  options,
}: {
  label: string;
  queryKey: string;
  options: FilterOption[];
}) => {
  const { onUpdate } = useFilterContext();
  const selectedValue = useFilterData(queryKey)[0];

  const onSelect = useCallback(
    (option: FilterOption) => {
      onUpdate(
        queryKey,
        selectedValue === option.value ? undefined : option.value,
      );
    },
    [onUpdate, queryKey, selectedValue],
  );

  const onReset = useCallback(() => {
    onUpdate(queryKey, undefined);
  }, [onUpdate, queryKey]);

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        onReset={onReset}
        showReset={Boolean(selectedValue)}
      />
      <FilterBadgesContainer isEmpty={!options.length}>
        {options.map((option) => {
          const selected = selectedValue === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option)}
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                "border gap-2",
                selected
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border",
              )}
            >
              <span className="text-sm font-medium capitalize">
                {option.label}
              </span>
              {option.logo && (
                <Avatar className="w-4 h-4">
                  <AvatarImage src={option.logo} />
                  <AvatarFallback>{option.label.charAt(0)}</AvatarFallback>
                </Avatar>
              )}
            </button>
          );
        })}
      </FilterBadgesContainer>
    </FilterSection>
  );
};

const SearchableMultiSelectFilter = ({
  label,
  queryKey,
  options,
  placeholder = "Search",
}: {
  label: string;
  queryKey: string;
  options: FilterOption[];
  placeholder?: string;
}) => {
  const { onUpdate } = useFilterContext();
  const data = useFilterData(queryKey);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(data), [data]);
  const selectedOptions = useMemo(
    () => options.filter((option) => selected.has(option.value)),
    [options, selected],
  );
  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return options
      .filter((option) => !selected.has(option.value))
      .filter((option) => {
        if (!term) return true;
        return (
          option.label.toLowerCase().includes(term) ||
          option.value.toLowerCase().includes(term)
        );
      })
      .slice(0, 8);
  }, [options, search, selected]);

  const onSelect = useCallback(
    (option: FilterOption) => {
      onUpdate(queryKey, [...data, option.value]);
      setSearch("");
      setOpen(false);
    },
    [data, onUpdate, queryKey],
  );

  const onRemove = useCallback(
    (value: string) => {
      onUpdate(
        queryKey,
        data.filter((item) => item !== value),
      );
    },
    [data, onUpdate, queryKey],
  );

  const onReset = useCallback(() => {
    onUpdate(queryKey, []);
    setSearch("");
  }, [onUpdate, queryKey]);

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        onReset={onReset}
        showReset={Boolean(data.length)}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="h-10 bg-background/50 pl-9"
        />
        {open && (
          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                  className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <span>{option.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {option.value}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No actions found
              </div>
            )}
          </div>
        )}
      </div>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-2">
          {selectedOptions.map((option) => (
            <SelectedBadge
              key={option.value}
              onClick={() => onRemove(option.value)}
              text={option.label}
            />
          ))}
        </div>
      )}
    </FilterSection>
  );
};

const FilterSection = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 bg-muted/30 rounded-xl border border-border",
        className,
      )}
    >
      {children}
    </div>
  );
};

const FilterBadgesContainer = ({
  children,
  className,
  isEmpty = false,
}: {
  children: ReactNode;
  className?: string;
  isEmpty?: boolean;
}) => {
  if (isEmpty) return null;
  return (
    <div
      className={cn("flex items-center gap-2 flex-row flex-wrap", className)}
    >
      {children}
    </div>
  );
};

const FilterHeader = ({
  label,
  onReset,
  showReset = false,
}: {
  label: string;
  onReset: () => void;
  showReset?: boolean;
}) => {
  return (
    <div className="flex items-center gap-2 w-full justify-between">
      <span className="text-sm font-medium text-foreground">{label}</span>
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

const InputWithBadgesFilter = ({
  label,
  queryKey,
  placeholder,
  className,
  inputType = "text",
  validateValue = () => true,
  modifyDisplayValue = (value: string) => value,
}: {
  label: string;
  queryKey: string;
  placeholder: string;
  className?: string;
  inputType?: "text" | "number";
  modifyDisplayValue?: (value: string) => string;
  validateValue?: (value: string) => boolean;
}) => {
  const [inputValue, setInputValue] = useState("");
  const { onUpdate } = useFilterContext();
  const data = useFilterData(queryKey);

  const onSelect = useCallback(
    (option: string) => {
      const newData = data?.includes(option)
        ? data.filter((it) => it !== option)
        : [...(data || []), option];
      onUpdate(queryKey, newData);
    },
    [data, onUpdate, queryKey],
  );

  const disabledBtn = useMemo(() => {
    return !inputValue || data?.includes(inputValue);
  }, [inputValue, data]);

  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === "Enter" && !disabledBtn) {
        if (!validateValue(inputValue)) {
          return;
        }
        onSelect(inputValue);
        setInputValue("");
      }
    },
    [onSelect, inputValue, disabledBtn, validateValue],
  );

  return (
    <FilterSection className={className}>
      <FilterHeader
        label={label}
        onReset={() => onUpdate(queryKey, [])}
        showReset={Boolean(data?.length)}
      />
      <div className="flex items-center gap-2 w-full">
        <Input
          onKeyDown={onKeyDown}
          className="flex-1 h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
          type={inputType}
          placeholder={placeholder}
          onChange={(e) => setInputValue(e.target.value)}
          value={inputValue}
        />
        <Button
          disabled={disabledBtn}
          onClick={() => {
            if (!inputValue) return;
            if (!validateValue(inputValue)) {
              return;
            }
            onSelect(inputValue);
            setInputValue("");
          }}
          size="icon"
          className="shrink-0 h-10 w-10 bg-primary hover:bg-primary/80 text-white disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      {data && data.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          {data.map((option) => (
            <SelectedBadge
              key={option}
              onClick={() => onSelect(option)}
              text={modifyDisplayValue(option)}
            />
          ))}
        </div>
      )}
    </FilterSection>
  );
};

const TokensFilter = () => {
  return (
    <>
      <InputWithBadgesFilter
        className="flex-1"
        queryKey={URL_QUERY_KEYS.IN_TOKEN}
        label="In Token"
        placeholder="In Token"
        modifyDisplayValue={(value) => value.toUpperCase()}
      />
      <InputWithBadgesFilter
        className="flex-1"
        queryKey={URL_QUERY_KEYS.OUT_TOKEN}
        label="Out Token"
        placeholder="Out Token"
        modifyDisplayValue={(value) => value.toUpperCase()}
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
    <BadgesFilter
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Chains"
      options={options}
      singleSelect={true}
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
    <BadgesFilter
      queryKey={URL_QUERY_KEYS.PARTNER_ID}
      label="Partners"
      options={options}
      singleSelect={true}
    />
  );
};

const UserFilter = () => {
  return (
    <InputWithBadgesFilter
      queryKey={URL_QUERY_KEYS.USER}
      label="Users"
      placeholder="Insert User Address"
      modifyDisplayValue={(value) => shortenAddress(value)}
      validateValue={(value) => isValidWalletAddress(value)}
    />
  );
};

const FilterModalButtons = ({ onClose }: { onClose: () => void }) => {
  const { onSubmit } = useFilterContext();
  const { setQuery } = useQueryFilterParams();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="gap-2 cursor-pointer"
        onClick={() => {
          setQuery.resetQuery();
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
          onSubmit();
          onClose();
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
  const data = useFilterData(queryKey)[0];
  const { onUpdate } = useFilterContext();

  return (
    <FilterSection>
      <FilterHeader
        label={label}
        onReset={() => onUpdate(queryKey, undefined)}
        showReset={!!data}
      />
      <Input
        className="h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 placeholder:text-muted-foreground/60"
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
          value={toDatetimeLocal(from)}
          onChange={(event) => updateFrom(event.target.value)}
          className="h-10 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20"
        />
        <Input
          type="datetime-local"
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
      placeholder="Input Min Dollar Value"
      queryKey={URL_QUERY_KEYS.MIN_DOLLAR_VALUE}
      label="Min Dollar Value"
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
      <Button variant="outline" className="gap-2">
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
    <FilterContextProvider>
      <Drawer direction="right" open={open} onOpenChange={setOpen}>
        <FiltersTrigger countKeys={countKeys} />
        <DrawerContent className="fixed right-0 top-0 h-full bg-card border-l border-border outline-none flex flex-col">
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
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="w-4 h-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto p-4">
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
        </DrawerContent>
      </Drawer>
    </FilterContextProvider>
  );
};

const SelectedBadge = ({
  text,
  onClick,
  className,
}: {
  text: string;
  onClick: () => void;
  className?: string;
}) => {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer",
        "bg-primary/20 text-primary border border-primary/30",
        "hover:bg-primary/30 transition-colors",
        className,
      )}
      onClick={onClick}
    >
      <span>{text}</span>
      <X className="w-3 h-3" />
    </button>
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
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors group cursor-pointer"
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
          onClick={() => setQuery.resetQuery()}
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

QueryFilters.Badge = BadgesFilter;
QueryFilters.SingleBadge = SingleValueBadgesFilter;
QueryFilters.SearchableMultiSelect = SearchableMultiSelectFilter;
QueryFilters.BadgeWithInput = InputWithBadgesFilter;
QueryFilters.Input = InputFilter;
QueryFilters.Timestamp = TimestampRangeFilter;
QueryFilters.Active = ActiveQueryFilters;
