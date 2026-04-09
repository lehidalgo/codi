---
editUrl: false
next: false
prev: false
title: "resolveConfig"
---

```ts
function resolveConfig(projectRoot): Promise<Result<NormalizedConfig>>;
```

Defined in: [core/config/resolver.ts:16](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/resolver.ts#L16)

Resolves the full project configuration by reading .codi/ as the single source of truth.
All artifacts (rules, skills, agents, commands), flags, and MCP configs come from .codi/.
Presets are consumed at install time — they are not loaded during config resolution.

## Parameters

<table>
<thead>
<tr>
<th>Parameter</th>
<th>Type</th>
</tr>
</thead>
<tbody>
<tr>
<td>

`projectRoot`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

## Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`NormalizedConfig`](/codi/docs/api/types/interfaces/normalizedconfig/)\>\>
