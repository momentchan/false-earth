import * as THREE from 'three'

// Core VAT metadata interface
// New format with textureWidth, textureHeight, textures, padding, etc.
export interface VATMeta {
  frameCount: number
  textureWidth: number
  textureHeight: number
  textures: {
    position: string
    normal: string
  }
  padding?: number // Space between columns (default: 2)
  compressNormal?: boolean // Whether normals are compressed (oct-encoded)
  glb?: string // GLB file path
  fps?: number
  storeDelta?: boolean
}

// Material controls interface
export interface VATMaterialControls {
  roughness: number
  metalness: number
  transmission: number
  thickness: number
  ior: number
  clearcoat: number
  clearcoatRoughness: number
  reflectivity: number
  envMapIntensity: number
  sheen: number
  sheenRoughness: number
  sheenColor: string
  iridescence: number
  iridescenceIOR: number
  iridescenceThicknessMin: number
  iridescenceThicknessMax: number
  attenuationDistance: number
  attenuationColor: string
  bumpScale: number
}

// Common VAT props shared across components
export interface CommonVATProps {
  scene: THREE.Group
  posTex: THREE.Texture
  nrmTex?: THREE.Texture | null
  metaData: VATMeta
  position?: [number, number, number]
  id?: string | number
}

// Shader override interface (only shader code, no uniforms)
export interface VATShaderOverrides {
  vertexShader?: string
  fragmentShader?: string
  depthVertexShader?: string
}

// Mesh configuration interface
export interface VATMeshConfig {
  frustumCulled?: boolean
  castShadow?: boolean
  receiveShadow?: boolean
  [key: string]: any
}

// VATMesh props interface
export interface VATMeshProps extends CommonVATProps {
  vatSpeed?: number
  paused?: boolean
  useDepthMaterial?: boolean
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  frameRatio?: number
  shaders?: VATShaderOverrides
  customUniforms?: Record<string, any>
  meshConfig?: VATMeshConfig
  materialConfig?: Partial<VATMaterialControls>
}

// Default material values
export const DEFAULT_VAT_MATERIAL: VATMaterialControls = {
  roughness: 0.4,
  metalness: 0.6,
  transmission: 0,
  thickness: 0,
  ior: 1.5,
  clearcoat: 0.1,
  clearcoatRoughness: 0.1,
  reflectivity: 0.5,
  envMapIntensity: 1,
  bumpScale: 1.0,
  sheen: 0,
  sheenRoughness: 0.1,
  sheenColor: '#3695ff',
  iridescence: 0,
  iridescenceIOR: 1.3,
  iridescenceThicknessMin: 100,
  iridescenceThicknessMax: 400,
  attenuationDistance: Infinity,
  attenuationColor: '#ffffff',
}
