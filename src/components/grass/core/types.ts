import { instancedArray, storage } from 'three/tsl'
import * as THREE from 'three/webgpu'
import { TerrainUniforms } from '../../terrain/types'

export interface TerrainParams {
  amplitude: number
  frequency: number
  seed: number
  color: string
}

export interface GrassProps {
  terrainUniforms?: TerrainUniforms;
  cullCamera?: THREE.PerspectiveCamera; // Camera used for culling calculation (separate from render camera)
  trailTexture?: THREE.StorageTexture | null; // Character trail texture for flattening grass
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

