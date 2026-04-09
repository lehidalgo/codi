---
editUrl: false
next: false
prev: false
title: "AgentFrontmatterOutput"
---

```ts
type AgentFrontmatterOutput = object;
```

Defined in: [schemas/agent.ts:30](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/schemas/agent.ts#L30)

## Type Declaration

### background?

```ts
optional background?: boolean;
```

### color?

```ts
optional color?: string;
```

### description

```ts
description: string;
```

### disallowedTools?

```ts
optional disallowedTools?: string[];
```

### effort?

```ts
optional effort?: "high" | "medium" | "low" | "max";
```

### isolation?

```ts
optional isolation?: string;
```

### managed\_by

```ts
managed_by: "codi" | "user";
```

### maxTurns?

```ts
optional maxTurns?: number;
```

### mcpServers?

```ts
optional mcpServers?: string[];
```

### memory?

```ts
optional memory?: "user" | "project" | "none";
```

### model?

```ts
optional model?: string;
```

### name

```ts
name: string;
```

### permissionMode?

```ts
optional permissionMode?: "unrestricted" | "readonly" | "limited";
```

### skills?

```ts
optional skills?: string[];
```

### tools?

```ts
optional tools?: string[];
```

### version

```ts
version: number;
```
