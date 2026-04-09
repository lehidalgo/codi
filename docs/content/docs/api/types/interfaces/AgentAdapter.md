---
editUrl: false
next: false
prev: false
title: "AgentAdapter"
---

Defined in: [types/agent.ts:54](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L54)

## Properties

### capabilities

```ts
capabilities: AgentCapabilities;
```

Defined in: [types/agent.ts:59](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L59)

***

### id

```ts
id: string;
```

Defined in: [types/agent.ts:55](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L55)

***

### name

```ts
name: string;
```

Defined in: [types/agent.ts:56](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L56)

***

### paths

```ts
paths: AgentPaths;
```

Defined in: [types/agent.ts:58](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L58)

## Methods

### detect()

```ts
detect(projectRoot): Promise<boolean>;
```

Defined in: [types/agent.ts:57](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L57)

#### Parameters

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

#### Returns

`Promise`\<`boolean`\>

***

### generate()

```ts
generate(config, options): Promise<GeneratedFile[]>;
```

Defined in: [types/agent.ts:60](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/types/agent.ts#L60)

#### Parameters

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

`config`

</td>
<td>

[`NormalizedConfig`](/codi/docs/api/types/interfaces/normalizedconfig/)

</td>
</tr>
<tr>
<td>

`options`

</td>
<td>

[`GenerateOptions`](/codi/docs/api/types/interfaces/generateoptions/)

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`GeneratedFile`](/codi/docs/api/types/interfaces/generatedfile/)[]\>
