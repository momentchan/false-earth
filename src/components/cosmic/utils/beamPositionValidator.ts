// ============================================================================
// Beam Position Validator
// ============================================================================

import * as THREE from 'three/webgpu';
import { MIN_BEAM_DISTANCE } from '../config';

/**
 * Checks if a position is valid (not too close to existing beams)
 * @param position - Candidate position to validate
 * @param activePositions - Array of existing beam positions
 * @returns true if position is valid, false otherwise
 */
export function isPositionValid(
  position: THREE.Vector3,
  activePositions: THREE.Vector3[]
): boolean {
  for (const activePos of activePositions) {
    const distance = position.distanceTo(activePos);
    if (distance < MIN_BEAM_DISTANCE) {
      return false;
    }
  }
  return true;
}

/**
 * Generates a random position in a donut shape around a center point
 * @param center - Center position (usually character position)
 * @param minRadius - Minimum distance from center
 * @param maxRadius - Maximum distance from center
 * @returns Random position in donut shape
 */
export function generateRandomDonutPosition(
  center: THREE.Vector3,
  minRadius: number,
  maxRadius: number
): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const distance = minRadius + (maxRadius - minRadius) * Math.random();
  
  return new THREE.Vector3(
    center.x + Math.cos(angle) * distance,
    0,
    center.z + Math.sin(angle) * distance
  );
}
