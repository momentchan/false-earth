import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { VATMeta, VATShaderOverrides, VATMeshConfig } from '../types'
import { createVATMaterial, createVATDepthMaterial } from '../materials'


/**
 * Setup VAT geometry: generate UV1 coordinates and convert coordinate system
 * - Generates UV1 coordinates matching Unity's VAT texture layout
 * - Converts positions from Unity's left-handed to Three.js right-handed coordinate system
 */
export function setupVATGeometry(geometry: THREE.BufferGeometry, meta: VATMeta): void {
  const count = geometry.getAttribute('position').count
  const positionAttr = geometry.getAttribute('position')
  
  const uv1Array = new Float32Array(count * 2)
  const positionArray = new Float32Array(count * 3)
  const padding = meta.padding ?? 2 // Space between columns (default: 2)
  const adjustedFramesCount = meta.frameCount + padding
  
  for(let i = 0; i < count; i++) {
    // Calculate UV1 coordinates based on vertex index (matching Unity's getCoord logic)
    const columnIndex = Math.floor(i / meta.textureHeight)
    const verticalIndex = i % meta.textureHeight
    
    const uIdx = columnIndex * adjustedFramesCount
    const vIdx = verticalIndex
    
    const u = (uIdx + 0.5) / meta.textureWidth
    const v = (vIdx + 0.5) / meta.textureHeight
    
    uv1Array[2 * i + 0] = u
    uv1Array[2 * i + 1] = v

    // Convert coordinate system: Unity (left-handed) -> Three.js (right-handed)
    // Flip X axis to convert from left-handed to right-handed
    positionArray[3 * i + 0] = positionAttr.getX(i) * -1
    positionArray[3 * i + 1] = positionAttr.getY(i)
    positionArray[3 * i + 2] = positionAttr.getZ(i)
  }
  
  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1Array, 2))
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
}

// ========== VAT Material Setup Utils ==========

/**
 * Common material creation parameters
 */
interface VATMaterialParams {
  posTex: THREE.Texture
  nrmTex: THREE.Texture | null
  envMap: THREE.Texture | null
  metaData: VATMeta
  materialControls: any
  shaderOverrides?: VATShaderOverrides
  customUniforms?: Record<string, any>
}

/**
 * Create VAT materials (main and optionally depth)
 */
function createVATMaterials(
  params: VATMaterialParams,
  useDepthMaterial: boolean
): {
  vatMaterial: CustomShaderMaterial
  vatDepthMaterial?: CustomShaderMaterial
  materials: CustomShaderMaterial[]
} {
  const materials: CustomShaderMaterial[] = []
  
  const vatMaterial = createVATMaterial(
    params.posTex,
    params.nrmTex,
    params.envMap,
    params.metaData,
    params.materialControls,
    params.shaderOverrides,
    params.customUniforms
  )
  materials.push(vatMaterial)

  let vatDepthMaterial: CustomShaderMaterial | undefined
  if (useDepthMaterial) {
    vatDepthMaterial = createVATDepthMaterial(
      params.posTex,
      params.nrmTex,
      params.metaData,
      params.shaderOverrides,
      params.customUniforms
    )
    materials.push(vatDepthMaterial)
  }

  return { vatMaterial, vatDepthMaterial, materials }
}

/**
 * Configure mesh shadow and culling properties
 */
function configureMeshProperties(
  mesh: THREE.Mesh | THREE.InstancedMesh,
  meshConfig?: VATMeshConfig
): void {
  const defaultConfig: VATMeshConfig = {
    frustumCulled: false,
    castShadow: true,
    receiveShadow: true
  }
  Object.assign(mesh, { ...defaultConfig, ...meshConfig })
}

/**
 * Create VAT mesh from geometry (similar to createVATInstancedMesh but for single mesh)
 */
export function createVATMesh(
  geometry: THREE.BufferGeometry,
  posTex: THREE.Texture,
  nrmTex: THREE.Texture | null,
  envMap: THREE.Texture | null,
  metaData: VATMeta,
  materialControls: any,
  useDepthMaterial: boolean,
  shaderOverrides?: VATShaderOverrides,
  customUniforms?: Record<string, any>,
  meshConfig?: VATMeshConfig
): {
  mesh: THREE.Mesh
  materials: CustomShaderMaterial[]
} {
  setupVATGeometry(geometry, metaData)

  const { vatMaterial, vatDepthMaterial, materials } = createVATMaterials(
    { posTex, nrmTex, envMap, metaData, materialControls, shaderOverrides, customUniforms },
    useDepthMaterial
  )

  const mesh = new THREE.Mesh(geometry, vatMaterial)
  
  if (vatDepthMaterial) {
    mesh.customDepthMaterial = vatDepthMaterial
  }

  configureMeshProperties(mesh, meshConfig)

  return { mesh, materials }
}

/**
 * Calculate VAT frame based on animation mode
 * Returns time position (0-1) representing animation progress
 */
export function calculateVATFrame(
  frameRatio: number | undefined,
  currentTime: number,
  metaData: VATMeta,
  speed: number
): number {
  if (frameRatio !== undefined) {
    return Math.max(0, Math.min(1, frameRatio))
  }
  // Calculate time position from elapsed time
  const fps = metaData.fps || 24
  const duration = metaData.frameCount / fps
  const timePosition = ((currentTime * speed) % duration) / duration
  return Math.max(0, Math.min(1, timePosition))
}

/**
 * Extract geometry from a THREE.Group/Scene
 */
export function extractGeometryFromScene(scene: THREE.Group): THREE.BufferGeometry | null {
  let geometry: THREE.BufferGeometry | null = null
  
  scene.traverse((object: any) => {
    if (object.isMesh && object.geometry && !geometry) {
      geometry = object.geometry.clone()
    }
  })
  
  return geometry
}

/**
 * Create VAT InstancedMesh
 */
export function createVATInstancedMesh(
  geometry: THREE.BufferGeometry,
  posTex: THREE.Texture,
  nrmTex: THREE.Texture | null,
  envMap: THREE.Texture | null,
  metaData: VATMeta,
  materialControls: any,
  instanceCount: number,
  useDepthMaterial: boolean,
  shaderOverrides?: VATShaderOverrides,
  customUniforms?: Record<string, any>,
  meshConfig?: VATMeshConfig
): {
  instancedMesh: THREE.InstancedMesh
  materials: CustomShaderMaterial[]
} {
  setupVATGeometry(geometry, metaData)

  const { vatMaterial, vatDepthMaterial, materials } = createVATMaterials(
    { posTex, nrmTex, envMap, metaData, materialControls, shaderOverrides, customUniforms },
    useDepthMaterial
  )

  const instancedMesh = new THREE.InstancedMesh(geometry, vatMaterial, instanceCount)
  
  // Create random seed attribute for each instance
  const seedArray = new Float32Array(instanceCount)
  const instanceIdArray = new Float32Array(instanceCount)
  for (let i = 0; i < instanceCount; i++) {
    seedArray[i] = Math.random()
    instanceIdArray[i] = i // Instance ID from 0 to instanceCount-1
  }
  instancedMesh.geometry.setAttribute('instanceSeed', new THREE.InstancedBufferAttribute(seedArray, 1))
  instancedMesh.geometry.setAttribute('instanceID', new THREE.InstancedBufferAttribute(instanceIdArray, 1))
  
  if (vatDepthMaterial) {
    instancedMesh.customDepthMaterial = vatDepthMaterial
  }

  configureMeshProperties(instancedMesh, meshConfig)

  return { instancedMesh, materials }
}
