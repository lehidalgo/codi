---
editUrl: false
next: false
prev: false
title: "SkillFrontmatterOutput"
---

```ts
type SkillFrontmatterOutput = object;
```

Defined in: [schemas/skill.ts:39](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/skill.ts#L39)

## Type Declaration

### agent?

```ts
optional agent?: string;
```

### allowedTools?

```ts
optional allowedTools?: string[];
```

### argumentHint?

```ts
optional argumentHint?: string;
```

### category?

```ts
optional category?: string;
```

### compatibility?

```ts
optional compatibility?: ("claude-code" | "cursor" | "codex" | "windsurf" | "cline")[];
```

### context?

```ts
optional context?: "fork";
```

### description

```ts
description: string;
```

### disableModelInvocation?

```ts
optional disableModelInvocation?: boolean;
```

### effort?

```ts
optional effort?: "high" | "medium" | "low" | "max";
```

### hooks?

```ts
optional hooks?: Record<string, string | string[]>;
```

### license?

```ts
optional license?: string;
```

### managed\_by

```ts
managed_by: "codi" | "user";
```

### metadata?

```ts
optional metadata?: Record<string, string>;
```

### model?

```ts
optional model?: string;
```

### name

```ts
name: string;
```

### paths?

```ts
optional paths?: string | string[];
```

### shell?

```ts
optional shell?: "bash" | "powershell";
```

### tools?

```ts
optional tools?: string[];
```

### type

```ts
type: "skill";
```

### user-invocable?

```ts
optional user-invocable?: boolean;
```

### version

```ts
version: number;
```
