---
editUrl: false
next: false
prev: false
title: "FlagDefinitionOutput"
---

```ts
type FlagDefinitionOutput = object;
```

Defined in: [schemas/flag.ts:58](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/flag.ts#L58)

## Type Declaration

### conditions?

```ts
optional conditions?: object;
```

#### conditions.agent?

```ts
optional agent?: string[];
```

#### conditions.file\_pattern?

```ts
optional file_pattern?: string[];
```

#### conditions.framework?

```ts
optional framework?: string[];
```

#### conditions.lang?

```ts
optional lang?: string[];
```

### locked

```ts
locked: boolean;
```

### mode

```ts
mode: 
  | "enforced"
  | "enabled"
  | "disabled"
  | "inherited"
  | "delegated_to_agent_default"
  | "conditional" = FlagModeSchema;
```

### value?

```ts
optional value?: string | number | boolean | string[];
```
