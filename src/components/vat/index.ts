// Main exports for VAT components
export { VATMesh } from './VATMesh'
export { VATInstancedMesh } from './VATInstancedMesh'

// Hooks
export { useVATPreloader } from './VATPreloader'

// Type exports
export type {
  VATMeta,
  VATMaterialControls,
  VATMeshProps,
  VATShaderOverrides,
  VATMeshConfig,
} from './types'
export { DEFAULT_VAT_MATERIAL } from './types'
export type { VATInstancedMeshProps } from './VATInstancedMesh'

// Utility exports
export {
  setupVATGeometry,
  calculateVATFrame,
  extractGeometryFromScene,
  createVATMesh,
  createVATInstancedMesh
} from './utils'

// Material exports
export {
  createVATMaterial,
  createVATDepthMaterial
} from './materials'
