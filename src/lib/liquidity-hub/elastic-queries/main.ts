export const queryInitialData = {
    fields: [
      {
        field: "*",
      },
      {
        field: "timestamp",
      },
    ],
    version: true,
    script_fields: {},
    stored_fields: ["*"],
    runtime_mappings: {},
    _source: false,
    highlight: {
      pre_tags: ["@kibana-highlighted-field@"],
      post_tags: ["@/kibana-highlighted-field@"],
      fields: {
        "*": {},
      },
    },
  };