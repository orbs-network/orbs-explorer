import axios from "axios";
import _ from "lodash";

export const normalizeSessions = (sessions: unknown[]) => {
  return _.map(sessions, (session) => {
    return _.mapValues(session as Record<string, unknown>, (value) => {
      if (Array.isArray(value) && _.size(value) === 1) {
        value = _.first(value);
      }
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    });
  });
};

export const queryInitialData = {
  fields: [{ field: "*" }, { field: "timestamp" }],
  version: true,
  script_fields: {},
  stored_fields: ["*"],
  runtime_mappings: {},
  _source: false,
  highlight: {
    pre_tags: ["@kibana-highlighted-field@"],
    post_tags: ["@/kibana-highlighted-field@"],
    fields: { "*": {} },
  },
};

export async function fetchElastic<T>(
  url: string,
  data: unknown,
  signal?: AbortSignal
): Promise<T[]> {
  const payload = typeof data === "object" && data !== null ? { ...data } : {};
  const response = await axios.post(`${url}/_search`, payload, { signal });
  return normalizeSessions(
    response.data.hits?.hits.map((hit: { fields: unknown }) => hit.fields) ?? []
  ) as T[];
}
