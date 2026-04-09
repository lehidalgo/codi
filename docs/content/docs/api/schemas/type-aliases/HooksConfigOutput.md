---
editUrl: false
next: false
prev: false
title: "HooksConfigOutput"
---

```ts
type HooksConfigOutput = object;
```

Defined in: [schemas/hooks.ts:28](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/hooks.ts#L28)

## Type Declaration

### custom

```ts
custom: Record<string, object[]>;
```

### hooks

```ts
hooks: Record<string, Record<string, object[]>>;
```

### install\_method

```ts
install_method: "git-hooks" | "husky-append" | "pre-commit-append" | "manual";
```

### runner

```ts
runner: "codi" | "none" | "husky" | "pre-commit";
```

### version

```ts
version: "1";
```
