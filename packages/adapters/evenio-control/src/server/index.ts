export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";

import type { AdapterConfigSchema } from "@paperclipai/adapter-utils";

export function getConfigSchema(): AdapterConfigSchema {
  return {
    fields: [
      {
        key: "maxWriteBytes",
        label: "Maximum handoff bytes",
        type: "number",
        default: 65536,
        hint: "Per-run private workspace handoff ceiling. Maximum 131072 bytes.",
      },
    ],
  };
}
