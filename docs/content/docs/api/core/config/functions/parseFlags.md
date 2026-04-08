---
editUrl: false
next: false
prev: false
title: "parseFlags"
---

```ts
function parseFlags(configDir): Promise<Result<Record<string, FlagDefinition>>>;
```

Defined in: [core/config/parser.ts:62](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/parser.ts#L62)

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

`configDir`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

## Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`Record`\<`string`, [`FlagDefinition`](/codi/docs/api/types/interfaces/flagdefinition/)\>\>\>
