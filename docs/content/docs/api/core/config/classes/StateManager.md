---
editUrl: false
next: false
prev: false
title: "StateManager"
---

Defined in: [core/config/state.ts:51](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L51)

## Constructors

### Constructor

```ts
new StateManager(configDir, projectRoot?): StateManager;
```

Defined in: [core/config/state.ts:55](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L55)

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

`configDir`

</td>
<td>

`string`

</td>
</tr>
<tr>
<td>

`projectRoot?`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

#### Returns

`StateManager`

## Methods

### detectDrift()

```ts
detectDrift(agentId): Promise<Result<DriftReport>>;
```

Defined in: [core/config/state.ts:140](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L140)

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

`agentId`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`DriftReport`](/codi/docs/api/core/config/interfaces/driftreport/)\>\>

***

### detectHookDrift()

```ts
detectHookDrift(): Promise<Result<DriftFile[]>>;
```

Defined in: [core/config/state.ts:213](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L213)

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`DriftFile`](/codi/docs/api/core/config/interfaces/driftfile/)[]\>\>

***

### detectPresetArtifactDrift()

```ts
detectPresetArtifactDrift(): Promise<Result<DriftFile[]>>;
```

Defined in: [core/config/state.ts:183](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L183)

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`DriftFile`](/codi/docs/api/core/config/interfaces/driftfile/)[]\>\>

***

### getAgentFiles()

```ts
getAgentFiles(agentId): Promise<Result<GeneratedFileState[]>>;
```

Defined in: [core/config/state.ts:134](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L134)

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

`agentId`

</td>
<td>

`string`

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`GeneratedFileState`](/codi/docs/api/core/config/interfaces/generatedfilestate/)[]\>\>

***

### read()

```ts
read(): Promise<Result<StateData>>;
```

Defined in: [core/config/state.ts:60](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L60)

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<[`StateData`](/codi/docs/api/core/config/interfaces/statedata/)\>\>

***

### updateAgent()

```ts
updateAgent(agentId, files): Promise<Result<void>>;
```

Defined in: [core/config/state.ts:102](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L102)

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

`agentId`

</td>
<td>

`string`

</td>
</tr>
<tr>
<td>

`files`

</td>
<td>

[`GeneratedFileState`](/codi/docs/api/core/config/interfaces/generatedfilestate/)[]

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`void`\>\>

***

### updateAgentsBatch()

```ts
updateAgentsBatch(updates): Promise<Result<void>>;
```

Defined in: [core/config/state.ts:112](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L112)

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

`updates`

</td>
<td>

`Record`\<`string`, [`GeneratedFileState`](/codi/docs/api/core/config/interfaces/generatedfilestate/)[]\>

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`void`\>\>

***

### updateHooks()

```ts
updateHooks(files): Promise<Result<void>>;
```

Defined in: [core/config/state.ts:124](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L124)

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

`files`

</td>
<td>

[`GeneratedFileState`](/codi/docs/api/core/config/interfaces/generatedfilestate/)[]

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`void`\>\>

***

### updatePresetArtifacts()

```ts
updatePresetArtifacts(files): Promise<Result<void>>;
```

Defined in: [core/config/state.ts:169](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L169)

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

`files`

</td>
<td>

[`ArtifactFileState`](/codi/docs/api/core/config/interfaces/artifactfilestate/)[]

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`void`\>\>

***

### write()

```ts
write(state): Promise<Result<void>>;
```

Defined in: [core/config/state.ts:81](https://github.com/lehidalgo/codi/blob/a2252a5e49d54b1212428345e273dc06c8f61bb0/src/core/config/state.ts#L81)

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

`state`

</td>
<td>

[`StateData`](/codi/docs/api/core/config/interfaces/statedata/)

</td>
</tr>
</tbody>
</table>

#### Returns

`Promise`\<[`Result`](/codi/docs/api/types/type-aliases/result/)\<`void`\>\>
