// ============================================================================
// Constants
// ============================================================================
import { struct } from 'three/tsl'

export const DEFAULT_GRID_SIZE = 512;
export const DEFAULT_PATCH_SIZE = 20;
export const HIGH_DETAIL_SEGMENTS = 14;
export const LOW_DETAIL_SEGMENTS = 4;  

// Legacy exports for backwards compatibility
export const GRID_SIZE = DEFAULT_GRID_SIZE;
export const PATCH_SIZE = DEFAULT_PATCH_SIZE;

// Helper function to calculate grass blades count
export function getGrassBladesCount(gridSize: number): number {
  return gridSize * gridSize;
}

// Color presets for tipColor
export const TIP_COLOR_PRESETS = [
  '#3e8d2f', // Default green
  '#4b4b4b', // Default gray
  '#8c502e', // Brown
  '#21546c', // Blue
  '#7c7c22', // Yellow
]

// ============================================================================
// Structures
// ============================================================================
export const grassStructure = struct({
  // Blade parameters
  bladeHeight: 'float',
  bladeWidth: 'float',
  bladeBend: 'float',
  bladeType: 'float',

  // Clump data
  toCenter: 'vec2',
  presence: 'float',
  clumpSeed01: 'float',

  // Motion seeds
  facingAngle01: 'float',
  perBladeHash01: 'float',
  windStrength01: 'float',
  lodSeed01: 'float',
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