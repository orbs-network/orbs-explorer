/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { URL_QUERY_KEYS } from "@/lib/consts";
import {
  cn,
  isValidWalletAddress,
  parseAppliedFilters,
  shortenAddress,
} from "@/lib/utils/utils";
import { networks } from "@orbs-network/spot-ui";
import { map, size } from "lodash";
import { Filter, Plus, X } from "lucide-react";
import {
  ReactNode,
  useState,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  createContext,
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

type FilterOption = {
  label: string;
  value: string;
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

  const onUpdate = useCallback(
    (queryKey: string, value?: string | string[]) => {
      setData((prev) => ({ ...prev, [queryKey]: value }));
    },
    []
  );

  const onSubmit = useCallback(() => {
    setQuery.updateQuery(
      data as Record<string, string | number | (string | number)[] | undefined>
    );
  }, [data, setQuery]);

  useEffect(() => {
    setData(query);
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

  return useMemo(
    () => {
      const value = data?.[queryKey as keyof typeof data] || []
      return Array.isArray(value) ? value : [value]
    },
    [data, queryKey]
  );
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
console.log({data});

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
    [data, onUpdate, queryKey, singleSelect]
  );

  const onReset = useCallback(() => {
    onUpdate(queryKey, []);
  }, [onUpdate, queryKey]);

  return (
    <div className="flex items-center gap-2 flex-col">
      <FilterHeader
        label={label}
        onReset={onReset}
        showReset={Boolean(data?.length)}
      />
      <FilterBadgesContainer>
        {options.map((option) => {
          const selected = data?.includes(option.value);
          return (
            <div key={option.value}>
              <Badge
                onClick={() => onSelect(option)}
                className={cn(
                  `bg-gray-700/80 hover:bg-gray-700 ${
                    selected && "bg-primary hover:bg-primary"
                  }  cursor-pointer`
                )}
              >
                {option.label}
              </Badge>
            </div>
          );
        })}
      </FilterBadgesContainer>
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
      className={cn(
        "flex items-center gap-2 flex-row flex-wrap bg-background w-full rounded-lg p-2",
        className
      )}
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
      <p className="text-sm text-white">{label}</p>
      {showReset ? (
        <div
          className="cursor-pointer text-gray-400 text-[12px] hover:text-white"
          onClick={onReset}
        >
          Reset
        </div>
      ) : null}
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
    [data, onUpdate, queryKey]
  );

  const disabledBtn = useMemo(() => {
    return !inputValue || data?.includes(inputValue);
  }, [inputValue, data]);

  const onKeyDown = useCallback(
    (e: any) => {
      if (e.key === "Enter") {
        onSelect(inputValue);
        setInputValue("");
      }
    },
    [onSelect, inputValue, setInputValue]
  );

  return (
    <div className={cn("flex items-center gap-2 flex-col", className)}>
      <FilterHeader
        label={label}
        onReset={() => onUpdate(queryKey, [])}
        showReset={Boolean(data?.length)}
      />
      <div className="flex items-center gap-2 w-full">
        <Input
          onKeyDown={onKeyDown}
          className="flex-1"
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
              alert("Invalid value");
              return;
            }
            onSelect(inputValue);
            setInputValue("");
          }}
          className="rounded-full bg-primary hover:bg-primary/80 text-white w-8 h-8 p-0"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <FilterBadgesContainer isEmpty={!data?.length}>
        {data?.map((option) => {
          return (
            <ActiveBadge
              key={option}
              onClick={() => onSelect(option)}
              text={modifyDisplayValue(option)}
            />
          );
        })}
      </FilterBadgesContainer>
    </div>
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

const ChainIdFilter = () => {
  const options = useMemo(() => {
    return map(networks, (network) => ({
      label: network.shortname,
      value: network.id.toString(),
    }));
  }, []);

  return (
    <BadgesFilter
      queryKey={URL_QUERY_KEYS.CHAIN_ID}
      label="Chains"
      options={options}
    />
  );
};

const PartnerIdFilter = () => {
  const options = useMemo(() => {
    return map(PARTNERS, (partner) => ({
      label: partner.name,
      value: partner.id,
    }));
  }, []);

  return (
    <BadgesFilter
      queryKey={URL_QUERY_KEYS.PARTNER_ID}
      label="Partners"
      options={options}
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

const FilterModalButton = () => {
  const { onSubmit } = useFilterContext();
  return (
    <DrawerClose className="mt-auto">
      <Button
        variant="default"
        className="w-full"
        onClick={() => {
          onSubmit();
        }}
      >
        Save
      </Button>
    </DrawerClose>
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
    <div className="flex items-center gap-2 flex-col">
      <FilterHeader
        label={label}
        onReset={() => onUpdate(queryKey, undefined)}
        showReset={!!data}
      />
      <Input
        placeholder={placeholder}
        onChange={(e) => onUpdate(queryKey, e.target.value)}
        value={data || ""}
      />
    </div>
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

const FiltersTrigger = () => {
  const { query } = useQueryFilterParams();
  const filtersCount = useMemo(() => {
    const { [URL_QUERY_KEYS.TIMESTAMP]: timestamp, ...rest } = query;
    return size(Object.values(rest).flat().filter(Boolean));
  }, [query]);

  return (
    <DrawerTrigger>
      <Button variant="outline">
        <div className="flex items-center gap-2 text-white">
          <Filter size={16} />
          <p className="hidden sm:block">Filters</p>
          <Badge>{filtersCount}</Badge>
        </div>
      </Button>
    </DrawerTrigger>
  );
};

export const QueryFilters = ({
  children,
  filters,
}: {
  children?: ReactNode;
  filters?: {
    userFilter?: boolean;
    minDollarValueFilter?: boolean;
    chainIdFilter?: boolean;
    partnerIdFilter?: boolean;
    tokensFilter?: boolean;
  };
}) => {
  return (
    <FilterContextProvider>
      <Drawer direction="right">
        <FiltersTrigger />
        <DrawerContent className="fixed right-0 top-0 bg-card border-l border-border outline-none overflow-y-auto">
          <DrawerHeader>
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white">Filters</DrawerTitle>
              <DrawerClose>
                <X className="w-5 h-5 text-white" />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="p-4 flex flex-col gap-4 h-full overflow-y-auto">
            <div className="flex flex-col gap-4">
              {!filters ? (
                <>
                  <TokensFilter />
                  <UserFilter />
                  <MinDollarValueFilter />
                  <ChainIdFilter />
                  <PartnerIdFilter />
                </>
              ) : (
                <>
                  {filters.userFilter && <UserFilter />}
                  {filters.minDollarValueFilter && <MinDollarValueFilter />}
                  {filters.chainIdFilter && <ChainIdFilter />}
                  {filters.partnerIdFilter && <PartnerIdFilter />}
                  {filters.tokensFilter && <TokensFilter />}
                </>
              )}
              {children}
            </div>
            <FilterModalButton />
          </div>
        </DrawerContent>
      </Drawer>
    </FilterContextProvider>
  );
};

const ActiveBadge = ({
  text,
  onClick,
  className,
}: {
  text: string;
  onClick: () => void;
  className?: string;
}) => {
  return (
    <Badge
      className={cn("cursor-pointer bg-primary hover:bg-primary", className)}
      onClick={onClick}
    >
      <span>{text}</span>
      <X className="w-4 h-4" onClick={onClick} />
    </Badge>
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

  return (
    <div className="flex gap-4 flex-col  w-full bg-gray-800/80 rounded-md p-4 mb-4">
      <div className="flex flex-row justify-between items-center">
        <p className="text-sm text-gray-400">Applied filters:</p>
        <div
          className="cursor-pointer text-gray-400"
          onClick={() => setQuery.resetQuery()}
        >
          clear all
        </div>
      </div>
      <div className="flex flex-wrap gap-2 flex-row justify-start items-center">
        {map(parseAppliedFilters(query), (item) => {
          if (typeof item.value === "string") {
            return (
              <ActiveBadge
                key={item.key}
                text={`${item.name}: ${item.value}`}
                onClick={() => onRemove(item.key, item.value as string)}
              />
            );
          }
          if (Array.isArray(item.value)) {
            return item.value.map((value) => (
              <ActiveBadge
                key={value}
                text={`${item.name}: ${value}`}
                onClick={() => onRemove(item.key, value)}
              />
            ));
          }
        })}
      </div>
    </div>
  );
}

QueryFilters.Badge = BadgesFilter;
QueryFilters.BadgeWithInput = InputWithBadgesFilter;
QueryFilters.Input = InputFilter;
QueryFilters.Active = ActiveQueryFilters;
