---
editUrl: false
next: false
prev: false
title: "RuleFrontmatterInput"
---

```ts
type RuleFrontmatterInput = object;
```

Defined in: [schemas/rule.ts:21](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/rule.ts#L21)

## Type Declaration

### alwaysApply?

```ts
optional alwaysApply?: boolean;
```

### description

```ts
description: string;
```

### language?

```ts
optional language?: string;
```

### managed\_by?

```ts
optional managed_by?: "codi" | "user";
```

### name

```ts
name: string;
```

### priority?

```ts
optional priority?: "high" | "medium" | "low";
```

### scope?

```ts
optional scope?: string[];
```

### type?

```ts
optional type?: "rule";
```

### version?

```ts
optional version?: number;
```
