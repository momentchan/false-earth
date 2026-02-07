// ============================================================================
// Constants
// ============================================================================
import { struct } from 'three/tsl'
import { instancedArray, storage } from 'three/tsl'
import * as THREE from 'three/webgpu'

export const DEFAULT_BLADES_PER_AXIS = 1024;
export const DEFAULT_GRASS_AREA_SIZE = 80;

// Default LOD segments configuration
export const DEFAULT_LOD_SEGMENTS_CONFIG = [
  {
    segments: 15,
    minDistance: 0,
    maxDistance: 5,
    debugColor: [1, 0, 0] as [number, number, number],
  },
  {
    segments: 3,
    minDistance: 5,
    maxDistance: 20,
    debugColor: [0, 1, 0] as [number, number, number],
  },
  {
    segments: 1,
    minDistance: 20,
    maxDistance: Infinity,
    debugColor: [0, 0, 1] as [number, number, number],
  },
] as const

// Color presets for tipColor
export const TIP_COLOR_PRESETS = [
  '#2e698c',
  '#3e8d2f', // Default green
  '#4b4b4b', // Default gray
  '#8c502e', // Brown
  '#21546c', // Blue
  '#7c7c22', // Yellow
]

// (4x vec4 = 64 bytes)
export const grassStructure = struct({
  // Data 0: Position(xyz) + Type(w)
  data0: 'vec4',
  // Data 1: Width(x), Height(y), Bend(z), WindStrength(w)
  data1: 'vec4',
  // Data 2: RotSin(x), RotCos(y), ClumpSeed(z), BladeSeed(w)
  data2: 'vec4',
  // Data 3: Compressed Normal(xz) + Push Vector(xy); vertex reconstructs tn.y from tn.x, tn.z
  data3: 'vec4',
})

// Indirect draw buffer structure (WebGPU draw indirect format)
// Structure matches WebGPU drawIndirect/drawIndexedIndirect format
// [vertexCount/indexCount, instanceCount, firstVertex/firstIndex, firstInstance, offset/baseVertex]
export const drawIndirectStructure = struct({
  vertexCount: 'uint', // For non-indexed: vertex count, for indexed: index count
  instanceCount: { type: 'uint', atomic: true }, // Atomic counter for visible instances
  firstVertex: 'uint', // For non-indexed: firstVertex, for indexed: firstIndex
  firstInstance: 'uint',
  offset: 'uint', // For non-indexed: offset, for indexed: baseVertex
})

// ============================================================================
// Types
// ============================================================================
export interface TerrainParams {
  amplitude: number
  frequency: number
  seed: number
  color: string
}

export interface GrassProps {
  cullCamera?: THREE.PerspectiveCamera; // Camera used for culling calculation (separate from render camera)
  trailTexture?: THREE.StorageTexture | null; // Character trail texture for flattening grass
  visible?: boolean; // Toggle visibility without remounting
}

export interface LODSegmentsConfig {
  segments: number
  minDistance: number
  maxDistance: number
  debugColor?: [number, number, number] // RGB color for LOD debug visualization
}

export interface LODBufferConfig {
  segments: number
  indices: ReturnType<typeof instancedArray>
  drawBuffer: THREE.IndirectStorageBufferAttribute
  drawStorage: ReturnType<typeof storage>
  vertexCount: number
  minDistance: number
  maxDistance: number
  debugColor?: [number, number, number] // RGB color for LOD debug visualization
}
