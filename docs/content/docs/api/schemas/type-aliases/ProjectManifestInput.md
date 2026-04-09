---
editUrl: false
next: false
prev: false
title: "ProjectManifestInput"
---

```ts
type ProjectManifestInput = object;
```

Defined in: [schemas/manifest.ts:31](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/manifest.ts#L31)

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

#### layers.agents?

```ts
optional agents?: boolean;
```

#### layers.context?

```ts
optional context?: boolean;
```

#### layers.rules?

```ts
optional rules?: boolean;
```

#### layers.skills?

```ts
optional skills?: boolean;
```

### name

```ts
name: string;
```

### presetRegistry?

```ts
optional presetRegistry?: object;
```

#### presetRegistry.branch?

```ts
optional branch?: string;
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
