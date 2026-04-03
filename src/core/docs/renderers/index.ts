/**
 * Re-exports all documentation section renderers.
 */
export {
  renderFlagsTable,
  renderFlagModes,
  renderFlagInstructions,
  renderFlagHooks,
} from "./flag-renderers.js";

export { renderPresetTable, renderPresetFlagComparison } from "./preset-renderers.js";

export {
  renderTemplateCounts,
  renderTemplateCountsCompact,
  renderRuleTemplateList,
  renderSkillTemplatesByCategory,
  extractSkillCategory,
  renderAgentTemplateList,
} from "./template-renderers.js";

export {
  renderAdapterTable,
  renderSupportedAgents,
  renderErrorCatalog,
  renderHubActions,
  renderMcpServers,
  renderCliReference,
  renderLayerOrder,
} from "./infrastructure-renderers.js";

export {
  extractZodFieldInfo,
  renderZodSchemaTable,
  renderRuleFields,
  renderSkillFields,
  renderAgentFields,
  renderManifestFields,
} from "./schema-renderers.js";

export { renderTestCoverage } from "./coverage-renderer.js";
