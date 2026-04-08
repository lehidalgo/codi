---
editUrl: false
next: false
prev: false
title: "RuleFrontmatterOutput"
---

```ts
type RuleFrontmatterOutput = object;
```

Defined in: [schemas/rule.ts:22](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/rule.ts#L22)

## Type Declaration

### alwaysApply

```ts
alwaysApply: boolean;
```

### description

```ts
description: string;
```

### language?

```ts
optional language?: string;
```

### managed\_by

```ts
managed_by: "codi" | "user";
```

### name

```ts
name: string;
```

### priority

```ts
priority: "high" | "medium" | "low";
```

### scope?

```ts
optional scope?: string[];
```

### type

```ts
type: "rule";
```

### version

```ts
version: number;
```
