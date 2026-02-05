import { struct } from 'three/tsl'
import { instancedArray, storage } from 'three/tsl'
import * as THREE from 'three/webgpu'

// ============================================================================
// Types
// ============================================================================

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

// LOD Configuration for Rose VAT
export interface RoseLODConfig {
  metaPath: string  // Path to VAT meta.json file
  minDistance: number
  maxDistance: number
  debugColor?: [number, number, number] // RGB color for LOD debug visualization
}

// LOD Buffer Configuration (runtime buffers)
export interface RoseLODBufferConfig extends RoseLODConfig {
  geometry: THREE.BufferGeometry
  posTex: THREE.Texture
  nrmTex: THREE.Texture
  meta: VATMeta
  indices: ReturnType<typeof instancedArray>
  drawBuffer: THREE.IndirectStorageBufferAttribute
  drawStorage: ReturnType<typeof storage>
  vertexCount: number
}

// ============================================================================
// Structures
// ============================================================================

// Shared VAT instance layout
export const vatStructure = struct({
  position: 'vec3',  // World coordinates
  isActive: 'float',   // Status: 0=dead, 1=alive (prepared for Spawn system)
  frame: 'float',    // Current animation frame (0-1)
  age: 'float',  // Time when the instance was spawned
  seed: 'float',  // Seed for random values
  progress: 'float', // Lifecycle progress [0,1]
})

// ============================================================================
// Constants
// ============================================================================

// Default LOD configuration for Rose
export const DEFAULT_ROSE_LOD_CONFIG: RoseLODConfig[] = [
  {
    metaPath: '/vat/Rose_meta.json',
    minDistance: 0,
    maxDistance: 5,
    debugColor: [1, 0, 0],
  },
  {
    metaPath: '/vat/RoseLowPoly_meta.json',  // Can be different VAT file
    minDistance: 5,
    maxDistance: Infinity,
    debugColor: [0, 1, 0],
  },
]

export const ROSE_TEXTURES = {
  petal: '/textures/Rose/Rose_Petal_Diff.ktx2',
  outline: '/textures/Rose/Rose_Outline.ktx2',
  normal: '/textures/Rose/Rose_Petal_Normal.ktx2'
}