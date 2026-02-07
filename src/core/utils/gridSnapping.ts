import { useRef, MutableRefObject, useMemo } from 'react';
import { Camera } from 'three';
import { useFrame } from '@react-three/fiber';
import { DEFAULT_GRASS_AREA_SIZE, DEFAULT_BLADES_PER_AXIS } from '../../components/grass/core/config';

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

  // Use single-blade spacing for snap step: avoids precision issues (e.g. 768)
  // and decouples movement from hashing grid; movement stays smooth and exact
  const gridCellSize = useMemo(() => {
    return grassAreaSize / DEFAULT_BLADES_PER_AXIS;
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
  });

  return {
    currentCellX: currentGridCellX,
    currentCellZ: currentGridCellZ,
    gridCellSize,
  };
}
