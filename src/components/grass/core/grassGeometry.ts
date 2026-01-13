import * as THREE from 'three/webgpu'
import { instancedArray } from 'three/tsl'
import { grassStructure } from './constants'

// Re-export IndirectStorageBufferAttribute for convenience
export type IndirectStorageBufferAttribute = THREE.IndirectStorageBufferAttribute

export function createBladeGeometry(segments: number = 14): THREE.PlaneGeometry {
  const bladeGeometry = new THREE.PlaneGeometry(1, 1, 1, segments)
  bladeGeometry.translate(0, 1 / 2, 0)
  return bladeGeometry
}

export function createPositions(bladesPerAxis: number, grassAreaSize: number) {
  const grassBlades = bladesPerAxis * bladesPerAxis
  const positionArray = new Float32Array(grassBlades * 3)

  for (let x = 0; x < bladesPerAxis; x++) {
    for (let z = 0; z < bladesPerAxis; z++) {
      const id = x * bladesPerAxis + z
      if (id >= grassBlades) break
      const fx = x / bladesPerAxis - 0.5
      const fz = z / bladesPerAxis - 0.5

      const px = fx * grassAreaSize
      const pz = fz * grassAreaSize

      positionArray[id * 3 + 0] = px
      positionArray[id * 3 + 1] = 0
      positionArray[id * 3 + 2] = pz
    }
  }

  return instancedArray(positionArray, 'vec3')
}


export function createGrassData(grassBlades: number) {
  // Calculate grass struct size with GPU alignment:
  // - 4 floats (blade params) = 16 bytes
  // - 1 vec2 (toCenter, 2 floats) = 8 bytes (aligned to 8-byte boundary)
  // - 2 floats (presence, clumpSeed01) = 8 bytes
  // - 3 floats (motion seeds) = 12 bytes
  // - Padding to align to 16-byte boundary = 4 bytes
  // Total: 12 floats = 48 bytes (required for WebGPU alignment)
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

