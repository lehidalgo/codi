---
editUrl: false
next: false
prev: false
title: "McpConfig"
---

Defined in: [types/config.ts:83](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/config.ts#L83)

## Properties

### servers

```ts
servers: Record<string, {
  args?: string[];
  command?: string;
  enabled?: boolean;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  type?: "stdio" | "http";
  url?: string;
}>;
```

Defined in: [types/config.ts:84](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/config.ts#L84)
