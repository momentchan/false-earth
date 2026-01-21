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
