---
editUrl: false
next: false
prev: false
title: "ProjectManifestOutput"
---

```ts
type ProjectManifestOutput = object;
```

Defined in: [schemas/manifest.ts:32](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/manifest.ts#L32)

## Type Declaration

### agents?

```ts
optional agents?: string[];
```

### description?

```ts
optional description?: string;
```

### engine?

```ts
optional engine?: object;
```

#### engine.requiredVersion?

```ts
optional requiredVersion?: string;
```

### layers?

```ts
optional layers?: object;
```

#### layers.agents

```ts
agents: boolean;
```

#### layers.context

```ts
context: boolean;
```

#### layers.rules

```ts
rules: boolean;
```

#### layers.skills

```ts
skills: boolean;
```

### name

```ts
name: string;
```

### presetRegistry?

```ts
optional presetRegistry?: object;
```

#### presetRegistry.branch

```ts
branch: string;
```

#### presetRegistry.url

```ts
url: string;
```

### presets?

```ts
optional presets?: string[];
```

### version

```ts
version: "1";
```
