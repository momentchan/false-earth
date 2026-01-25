import { struct } from 'three/tsl'

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

// ============================================================================
// Structures
// ============================================================================

// Shared VAT instance layout
export const vatStructure = struct({
  position: 'vec3',  // World coordinates
  isActive: 'float',   // Status: 0=dead, 1=alive (prepared for Spawn system)
  frame: 'float',    // Current animation frame (0-1)
  startTime: 'float',  // Time when the instance was spawned
  seed: 'float',  // Seed for random values
  progress: 'float', // Lifecycle progress [0,1]
})
