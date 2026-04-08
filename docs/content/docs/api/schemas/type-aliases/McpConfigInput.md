---
editUrl: false
next: false
prev: false
title: "McpConfigInput"
---

```ts
type McpConfigInput = object;
```

Defined in: [schemas/mcp.ts:17](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/mcp.ts#L17)

## Type Declaration

### servers?

```ts
optional servers?: Record<string, {
  args?: string[];
  command?: string;
  enabled?: boolean;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  type?: "stdio" | "http";
  url?: string;
}>;
```
