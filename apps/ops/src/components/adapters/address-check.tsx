"use client";

import { useId, useState } from "react";
import { Input } from "@orbs/ui/controls/input";
import { Button } from "@orbs/ui/controls/button";
import { Network } from "@orbs/ui/controls/network";
import { Panel } from "@/components/operations/primitives";
import { useOperationsData } from "@/components/operations/operations-view";
import {
  InvestigationSelect,
  InvestigationSelectItem,
} from "@/components/investigation/investigation-controls";
import { addressFormat } from "@/lib/adapter-registry";
import { checkSecurityAddress } from "@/lib/security-review";
import { AdapterMatchBadge } from "./adapter-match-badge";

export function AddressCheck() {
  const { config, networkOptions, isConfigError } = useOperationsData();
  const id = useId();
  const [address, setAddress] = useState("");
  const [expected, setExpected] = useState("");
  const [network, setNetwork] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const result = submitted
    ? checkSecurityAddress(address.trim(), Number(network) || undefined, config)
    : null;
  const expectedFormat = addressFormat(expected.trim());
  return (
    <Panel
      title="Check an adapter address"
      description="Paste the full address and choose its network. You can also compare it with an expected address from your own trusted source."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
        className="space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
          <div className="min-w-0 space-y-1.5">
            <label htmlFor={`${id}-address`} className="text-xs font-medium">
              Adapter address
            </label>
            <Input
              id={`${id}-address`}
              name="adapter_address"
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                setSubmitted(false);
              }}
              className="font-mono text-xs"
              required
            />
          </div>
          <InvestigationSelect
            label="Network"
            value={network}
            placeholder="Choose network"
            required
            onChange={(value) => {
              setNetwork(value);
              setSubmitted(false);
            }}
          >
            {networkOptions
              .filter((option) => Number(option.value) > 0)
              .map((option) => (
                <InvestigationSelectItem
                  key={option.value}
                  value={option.value}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Network
                      chainId={Number(option.value)}
                      variant="inline"
                      showChainId={false}
                    />
                    <span>({option.value})</span>
                  </span>
                </InvestigationSelectItem>
              ))}
          </InvestigationSelect>
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor={`${id}-expected`} className="text-xs font-medium">
            Expected address{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </label>
          <Input
            id={`${id}-expected`}
            name="expected_address"
            autoComplete="off"
            spellCheck={false}
            placeholder="Address from a trusted source…"
            value={expected}
            onChange={(event) => {
              setExpected(event.target.value);
              setSubmitted(false);
            }}
            className="font-mono text-xs"
          />
        </div>
        <Button type="submit" size="sm">
          Check address
        </Button>
      </form>
      <div aria-live="polite">
        {result && (
          <div className="mt-4 space-y-2 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed">
            <p className="font-medium">
              {result.format === "missing"
                ? "Enter an address."
                : result.format === "invalid"
                  ? "Invalid address format. Use a 20-byte hexadecimal address starting with 0x."
                  : result.format === "checksum"
                    ? "The mixed-case checksum is invalid. Confirm the address with its source before using it."
                    : result.zero
                      ? "Zero address. This cannot identify a configured exchange adapter."
                      : "Address format is valid."}
            </p>
            {result.format === "valid" && !result.zero && (
              <>
                <AdapterMatchBadge
                  comparison={result.match}
                  knownNetworks={result.knownNetworks}
                  cached={isConfigError}
                />
                {result.names.length > 0 && <p>{result.names.join(", ")}.</p>}
                {result.match === "other-network" && (
                  <p>This address does not match on the selected network.</p>
                )}
                <code className="block break-all">{address.trim()}</code>
              </>
            )}
            {expected.trim() && (
              <p className="font-medium">
                {expectedFormat !== "valid"
                  ? "The expected address is invalid. Confirm it with your trusted source."
                  : result.format !== "valid" || result.zero
                    ? "Fix the adapter address before comparing it."
                    : address.trim().toLowerCase() ===
                        expected.trim().toLowerCase()
                      ? "Matches the expected address on your selected network."
                      : "Does not match the expected address. Verify both addresses before using them."}
              </p>
            )}
            <p className="text-muted-foreground">
              Format and catalog matches do not establish ownership, contract
              safety, or token authenticity.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}
