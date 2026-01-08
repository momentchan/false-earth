import * as THREE from 'three/webgpu'
import { instancedArray } from 'three/tsl'
import { HIGH_DETAIL_SEGMENTS, grassStructure } from '../constants'

// Re-export IndirectStorageBufferAttribute for convenience
export type IndirectStorageBufferAttribute = THREE.IndirectStorageBufferAttribute

// Seeded Random Number Generator (for consistent position generation)
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export function createBladeGeometry(segments: number = HIGH_DETAIL_SEGMENTS): THREE.PlaneGeometry {
  const bladeGeometry = new THREE.PlaneGeometry(1, 1, 1, segments)
  bladeGeometry.translate(0, 1 / 2, 0)
  return bladeGeometry
}

export function createPositions(gridSize: number, patchSize: number) {
  const grassBlades = gridSize * gridSize
  const positionArray = new Float32Array(grassBlades * 3)

  for (let x = 0; x < gridSize; x++) {
    for (let z = 0; z < gridSize; z++) {
      const id = x * gridSize + z
      if (id >= grassBlades) break
      const fx = x / gridSize - 0.5
      const fz = z / gridSize - 0.5

      const seed = (x * 7919 + z * 7919) * 0.0001
      const jitterX = (seededRandom(seed) - 0.5) * 0.2
      const jitterZ = (seededRandom(seed + 1.0) - 0.5) * 0.2

      const px = fx * patchSize + jitterX
      const pz = fz * patchSize + jitterZ

      positionArray[id * 3 + 0] = px
      positionArray[id * 3 + 1] = 0
      positionArray[id * 3 + 2] = pz
    }
  }

  return instancedArray(positionArray, 'vec3')
}

export function createGrassData(grassBlades: number) {
  // Calculate grass struct size: 4 floats + 1 vec2 (2 floats) + 2 floats + 4 floats = 12 floats = 48 bytes
  const grassStructSize = 12
  const grassDataArray = new Float32Array(grassBlades * grassStructSize)
  grassDataArray.fill(0)
  return instancedArray(grassDataArray, grassStructure)
}

/**
 * Creates a buffer to store indices of visible grass blades
 * This buffer is written by the compute shader during culling
 */
export function createVisibleIndicesBuffer(grassBlades: number) {
  // Use Uint32Array for indices (max 4 billion blades)
  const visibleIndicesArray = new Uint32Array(grassBlades)
  visibleIndicesArray.fill(0)
  return instancedArray(visibleIndicesArray, 'uint')
}

