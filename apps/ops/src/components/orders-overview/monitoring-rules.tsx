"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@orbs/ui/controls/button";
import { Input } from "@orbs/ui/controls/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@orbs/ui/controls/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orbs/ui/controls/select";
import {
  DEFAULT_MONITORING_RULES,
  MONITORING_STORAGE_KEY,
  parseMonitoringRules,
  type MonitoringRules,
} from "@/lib/overview-monitoring";

const EVENT = "ops-monitoring-rules-changed";
const subscribe = (notify: () => void) => {
  const listener = (event: Event) => {
    if (
      !(event instanceof StorageEvent) ||
      event.key === MONITORING_STORAGE_KEY ||
      event.key === null
    )
      notify();
  };
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
};
const read = () => {
  try {
    return localStorage.getItem(MONITORING_STORAGE_KEY);
  } catch {
    return null;
  }
};
const server = () => null;

export function useMonitoringRules() {
  const raw = useSyncExternalStore(subscribe, read, server);
  const rules = useMemo(() => parseMonitoringRules(raw), [raw]);
  return {
    rules,
    saveRules: (next: MonitoringRules) => {
      try {
        localStorage.setItem(
          MONITORING_STORAGE_KEY,
          JSON.stringify({ version: 1, rules: next }),
        );
        window.dispatchEvent(new Event(EVENT));
        toast.success("Review rules saved in this browser");
        return true;
      } catch {
        toast.error(
          "Review rules could not be saved. Browser storage is unavailable.",
        );
        return false;
      }
    },
  };
}

type Draft = {
  rate: string;
  minimum: string;
  windowHours: "24" | "168";
  inactivity: Record<string, string>;
};
const toDraft = (rules: MonitoringRules): Draft => ({
  rate: String(rules.failureRatePercent),
  minimum: String(rules.minimumOrders),
  windowHours: String(rules.windowHours) as "24" | "168",
  inactivity: Object.fromEntries(
    Object.entries(rules.inactivityHours).map(([id, hours]) => [
      id,
      String(hours),
    ]),
  ),
});

export function MonitoringRulesEditor({
  rules,
  onSave,
  partnerOptions,
}: {
  rules: MonitoringRules;
  onSave: (rules: MonitoringRules) => boolean;
  partnerOptions: { value: string; label: string }[];
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(rules));
  const [partner, setPartner] = useState("");
  const [error, setError] = useState<string>();
  const [invalidField, setInvalidField] = useState<string>();
  const options = partnerOptions.filter(
    (option) => !(option.value in draft.inactivity),
  );
  const names = new Map(
    partnerOptions.map((option) => [option.value, option.label]),
  );
  return (
    <Drawer
      direction="right"
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(toDraft(rules));
          setError(undefined);
          setInvalidField(undefined);
          setPartner("");
        }
        setOpen(next);
      }}
    >
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Settings2 aria-hidden className="size-3.5" />
          Review rules
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full! sm:max-w-md">
        <DrawerHeader className="text-left">
          <DrawerTitle>Order review rules</DrawerTitle>
          <DrawerDescription>
            Flag patterns for investigation. These rules do not confirm
            infrastructure faults and are saved in this browser.
          </DrawerDescription>
        </DrawerHeader>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            const rate = Number(draft.rate),
              minimum = Number(draft.minimum);
            let message: string | undefined;
            let field: string | undefined;
            const invalidExpectation = Object.entries(draft.inactivity).find(
              ([, value]) =>
                !value.trim() ||
                !Number.isFinite(Number(value)) ||
                Number(value) < 1 ||
                Number(value) > 8760,
            );
            if (
              !draft.rate.trim() ||
              !Number.isFinite(rate) ||
              rate < 1 ||
              rate > 100
            ) {
              message = "Failure rate must be between 1 and 100%.";
              field = `${id}-rate`;
            } else if (
              !draft.minimum.trim() ||
              !Number.isInteger(minimum) ||
              minimum < 1 ||
              minimum > 10000
            ) {
              message =
                "Minimum order count must be a whole number between 1 and 10,000.";
              field = `${id}-minimum`;
            } else if (invalidExpectation) {
              message =
                "Expected order intervals must be between 1 and 8,760 hours.";
              field = `${id}-${encodeURIComponent(invalidExpectation[0])}`;
            }
            if (message) {
              setError(message);
              setInvalidField(field);
              if (field) document.getElementById(field)?.focus();
              toast.error(message, { id: `${id}-validation` });
              return;
            }
            if (
              onSave({
                failureRatePercent: rate,
                minimumOrders: minimum,
                windowHours: Number(draft.windowHours) as 24 | 168,
                inactivityHours: Object.fromEntries(
                  Object.entries(draft.inactivity).map(([key, value]) => [
                    key,
                    Number(value),
                  ]),
                ),
              })
            )
              setOpen(false);
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-2">
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                Elevated terminal failure rate
              </legend>
              <p className="text-xs text-muted-foreground">
                Failed orders divided by placed orders for each app. Cancelled,
                expired, and recovered attempts are not counted as failures.
              </p>
              <label
                className="block space-y-1.5 text-xs"
                htmlFor={`${id}-window`}
              >
                <span>Placement window</span>
                <Select
                  value={draft.windowHours}
                  name="review-window"
                  onValueChange={(value: "24" | "168") =>
                    setDraft({ ...draft, windowHours: value })
                  }
                >
                  <SelectTrigger id={`${id}-window`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">Last 24 hours</SelectItem>
                    <SelectItem value="168">Last 7 days</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5 text-xs" htmlFor={`${id}-rate`}>
                  <span>Failure rate at least (%)</span>
                  <Input
                    id={`${id}-rate`}
                    name="failure-rate"
                    autoComplete="off"
                    type="number"
                    min="1"
                    max="100"
                    value={draft.rate}
                    onChange={(event) =>
                      setDraft({ ...draft, rate: event.target.value })
                    }
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={invalidField === `${id}-rate`}
                  />
                </label>
                <label
                  className="space-y-1.5 text-xs"
                  htmlFor={`${id}-minimum`}
                >
                  <span>Minimum placed orders</span>
                  <Input
                    id={`${id}-minimum`}
                    name="minimum-orders"
                    autoComplete="off"
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={draft.minimum}
                    onChange={(event) =>
                      setDraft({ ...draft, minimum: event.target.value })
                    }
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={invalidField === `${id}-minimum`}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset className="space-y-3 border-t border-border pt-4">
              <legend className="text-sm font-medium">
                Expected app activity
              </legend>
              <p className="text-xs text-muted-foreground">
                Only add apps expected to receive regular orders. Last placement
                uses all available history within the network selection.
              </p>
              {Object.entries(draft.inactivity).map(([key, value]) => (
                <div key={key} className="flex items-end gap-2">
                  <label
                    htmlFor={`${id}-${encodeURIComponent(key)}`}
                    className="min-w-0 flex-1 space-y-1.5 text-xs"
                  >
                    <span
                      className="block truncate"
                      title={names.get(key) ?? key}
                    >
                      {names.get(key) ?? key} · at least one order every (hours)
                    </span>
                    <Input
                      id={`${id}-${encodeURIComponent(key)}`}
                      name={`activity-interval-${key}`}
                      autoComplete="off"
                      aria-invalid={
                        invalidField === `${id}-${encodeURIComponent(key)}`
                      }
                      aria-describedby={error ? `${id}-error` : undefined}
                      type="number"
                      min="1"
                      max="8760"
                      value={value}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          inactivity: {
                            ...draft.inactivity,
                            [key]: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove activity expectation for ${names.get(key) ?? key}`}
                    onClick={() => {
                      const next = { ...draft.inactivity };
                      delete next[key];
                      setDraft({ ...draft, inactivity: next });
                    }}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Select value={partner} onValueChange={setPartner}>
                  <SelectTrigger
                    className="min-w-0 flex-1"
                    aria-label="Trading app for expected activity"
                  >
                    <SelectValue placeholder="Choose a trading app" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!partner}
                  onClick={() => {
                    setDraft({
                      ...draft,
                      inactivity: { ...draft.inactivity, [partner]: "24" },
                    });
                    setPartner("");
                  }}
                >
                  Add
                </Button>
              </div>
            </fieldset>
            {error && (
              <p
                id={`${id}-error`}
                role="alert"
                className="text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <DrawerFooter className="border-t border-border">
            <Button type="submit">Save review rules</Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDraft(toDraft(DEFAULT_MONITORING_RULES));
                  setError(undefined);
                  setInvalidField(undefined);
                }}
              >
                Restore defaults
              </Button>
              <DrawerClose asChild>
                <Button type="button" variant="ghost" className="flex-1">
                  Cancel
                </Button>
              </DrawerClose>
            </div>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
