import { useRef, MutableRefObject, useMemo } from 'react';
import { Camera } from 'three';
import { useFrame } from '@react-three/fiber';
import { DEFAULT_GRASS_AREA_SIZE, DEFAULT_GRID_DIVISIONS, DEFAULT_BLADES_PER_AXIS } from './grass/core/constants';

export interface GridSnappingResult {
  snappedX: number;
  snappedZ: number;
  currentCellX: number;
  currentCellZ: number;
  hasChanged: boolean;
}

export interface UseGridSnappingOptions {
  camera: Camera;
  grassAreaSize?: number;
  onSnap?: (result: GridSnappingResult) => void;
}

/**
 * Hook to handle grid-based snapping for infinite terrain/grass
 * Calculates snapped position based on camera position and grid cell size
 * Grid cell size is calculated internally based on grass area size
 */
export function useGridSnapping({
  camera,
  grassAreaSize = DEFAULT_GRASS_AREA_SIZE,
  onSnap,
}: UseGridSnappingOptions): {
  currentCellX: MutableRefObject<number | null>;
  currentCellZ: MutableRefObject<number | null>;
  gridCellSize: number;
} {
  const currentGridCellX = useRef<number | null>(null);
  const currentGridCellZ = useRef<number | null>(null);

  // Calculate grid cell size internally
  const gridCellSize = useMemo(() => {
    const gridDivisions = DEFAULT_GRID_DIVISIONS;
    const bladesPerAxis = DEFAULT_BLADES_PER_AXIS;
    const bladeSpacing = grassAreaSize / bladesPerAxis;
    const rawGridCellSize = grassAreaSize / gridDivisions;
    return Math.round(rawGridCellSize / bladeSpacing) * bladeSpacing;
  }, [grassAreaSize]);

  useFrame(() => {
    if (!camera) return;

    const currentCellX = Math.floor(camera.position.x / gridCellSize);
    const currentCellZ = Math.floor(camera.position.z / gridCellSize);

    // Check if grid cell changed
    const hasChanged =
      currentGridCellX.current === null ||
      currentGridCellZ.current === null ||
      currentCellX !== currentGridCellX.current ||
      currentCellZ !== currentGridCellZ.current;

    if (hasChanged) {
      const snappedX = currentCellX * gridCellSize;
      const snappedZ = currentCellZ * gridCellSize;

      currentGridCellX.current = currentCellX;
      currentGridCellZ.current = currentCellZ;

      // Call callback if provided
      if (onSnap) {
        onSnap({
          snappedX,
          snappedZ,
          currentCellX,
          currentCellZ,
          hasChanged: true,
        });
      }
    }
  }, -1);

  return {
    currentCellX: currentGridCellX,
    currentCellZ: currentGridCellZ,
    gridCellSize,
  };
}