// ============================================================================
// Constants
// ============================================================================
export const DEFAULT_GRID_SIZE = 512;
export const DEFAULT_PATCH_SIZE = 20;
export const BLADE_SEGMENTS = 14;

// Legacy exports for backwards compatibility
export const GRID_SIZE = DEFAULT_GRID_SIZE;
export const PATCH_SIZE = DEFAULT_PATCH_SIZE;

// Helper function to calculate grass blades count
export function getGrassBladesCount(gridSize: number): number {
  return gridSize * gridSize;
}
