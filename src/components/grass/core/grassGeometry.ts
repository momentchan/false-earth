import * as THREE from 'three/webgpu'
import { instancedArray } from 'three/tsl'
import { grassStructure } from './config'

// Re-export IndirectStorageBufferAttribute for convenience
export type IndirectStorageBufferAttribute = THREE.IndirectStorageBufferAttribute

export function createBladeGeometry(segments: number = 14): THREE.PlaneGeometry {
  const bladeGeometry = new THREE.PlaneGeometry(1, 1, 1, segments)
  bladeGeometry.translate(0, 1 / 2, 0)
  return bladeGeometry
}

export function createGrassData(grassBlades: number) {
  const grassStructSize = 16
  const grassDataArray = new Float32Array(grassBlades * grassStructSize)
  grassDataArray.fill(0)
  return instancedArray(grassDataArray, grassStructure)
}

/**
 * Creates a buffer to store indices of visible grass blades
 * This buffer is written by the compute shader during culling
 */
export function createVisibleIndicesBuffer(grassBlades: number) {
  const visibleIndicesArray = new Uint32Array(grassBlades)
  visibleIndicesArray.fill(0)
  return instancedArray(visibleIndicesArray, 'uint')
}

