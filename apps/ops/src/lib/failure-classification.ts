export const FAILURE_REASON_CATEGORIES = [
  { id: "revert", label: "Transaction revert" },
  { id: "funds", label: "Funds or allowance" },
  { id: "rpc", label: "RPC or network" },
  { id: "timeout", label: "Timeout" },
  { id: "other", label: "Other reported reason" },
  { id: "unreported", label: "Reason unavailable" },
] as const;
export type FailureReasonCategory =
  (typeof FAILURE_REASON_CATEGORIES)[number]["id"];

/** Text hints only: these categories do not establish a root cause or system fault. */
export function classifyFailureReason(reason: unknown): FailureReasonCategory {
  if (typeof reason !== "string" || !reason.trim()) return "unreported";
  const text = reason.trim().toLowerCase();
  if (
    text === "no failure reason provided" ||
    text === "no failure reason reported" ||
    text === "earlier error reason unavailable in this summary"
  )
    return "unreported";
  // Specific explanations win over generic RPC or revert wrappers.
  if (
    /insufficient[\s_-]*(funds|balance|allowance)|erc20insufficient(balance|allowance)|(?:amount|transfer)[\s\S]*exceeds[\s\S]*(balance|allowance)|allowance[\s\S]*(too low|insufficient|not enough)|not enough[\s\S]*(funds|balance|allowance)/i.test(
      text,
    )
  )
    return "funds";
  if (
    /\btimeout\b|\btimed?\s+out\b|\betimedout\b|\bcontext deadline exceeded\b|\brequest deadline exceeded\b/i.test(
      text,
    )
  )
    return "timeout";
  if (/\brevert(?:ed|ing)?\b|\bcall_exception\b/i.test(text)) return "revert";
  if (
    /\b(?:json[- ]?)?rpc\b|\bnetwork error\b|\bconnection (?:refused|reset|closed)\b|\b(?:econnreset|econnrefused|enotfound)\b|\bcould not (?:detect|connect to) network\b/i.test(
      text,
    )
  )
    return "rpc";
  return "other";
}
