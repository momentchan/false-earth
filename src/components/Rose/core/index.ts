import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TextureLoader } from 'three'
import { VATMeta } from './config'

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

// Helper function to get the appropriate loader for file extension
function getLoaderForExtension(url: string) {
  const ext = url.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'exr':
      return EXRLoader
    case 'png':
    case 'jpg':
    case 'jpeg':
    default:
      return TextureLoader
  }
}

// Helper function to configure EXR loader
function configureEXRLoader(loader: any) {
  if (loader.constructor.name === 'EXRLoader') {
    loader.setDataType(THREE.FloatType)
  }
}

// Helper function to resolve relative paths from meta JSON
function resolvePath(metaUrl: string, relativePath: string): string {
  if (relativePath.startsWith('/') || relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath
  }
  // Extract base directory from metaUrl
  const metaDir = metaUrl.substring(0, metaUrl.lastIndexOf('/') + 1)
  return metaDir + relativePath
}

// Hook to preload VAT resources from meta JSON
// Extracts all paths (GLB, textures) from the meta JSON file
export function useVATPreloader(metaUrl: string) {
  // Load meta JSON first
  const metaResponse = useLoader(THREE.FileLoader, metaUrl)
  const meta = useMemo(() => {
    if (!metaResponse) return null
    return JSON.parse(metaResponse as string) as VATMeta
  }, [metaResponse])

  // Extract paths from meta
  const paths = useMemo(() => {
    if (!meta) return null
    
    const glbPath = meta.glb ? resolvePath(metaUrl, meta.glb) : null
    const posPath = meta.textures?.position ? resolvePath(metaUrl, meta.textures.position) : null
    const nrmPath = meta.textures?.normal ? resolvePath(metaUrl, meta.textures.normal) : null
    
    return { glbPath, posPath, nrmPath }
  }, [meta, metaUrl])

  // Determine mesh type and load
  const meshExt = paths?.glbPath?.split('.').pop()?.toLowerCase()
  const isFBX = meshExt === 'fbx'
  const isGLTF = meshExt === 'gltf' || meshExt === 'glb'
  
  // Load mesh using appropriate loader
  // Note: This conditionally calls hooks, which technically violates React's rules.
  // However, since metaUrl is a prop and typically doesn't change during component lifetime,
  // this works in practice. If metaUrl changes dynamically, consider using separate hooks
  // or a factory pattern to ensure hooks are always called in the same order.
  const fbxScene = (isFBX && paths?.glbPath) ? (useLoader(FBXLoader, paths.glbPath) as THREE.Group) : null
  const gltfScene = (isGLTF && paths?.glbPath) ? (useLoader(GLTFLoader, paths.glbPath) as { scene: THREE.Group }) : null
  
  // Select the appropriate scene
  const scene = isFBX ? fbxScene! : (gltfScene?.scene || null)

  // Load textures
  const posTex = paths?.posPath ? useLoader(getLoaderForExtension(paths.posPath), paths.posPath, configureEXRLoader) : null
  const nrmTex = paths?.nrmPath ? useLoader(getLoaderForExtension(paths.nrmPath), paths.nrmPath, configureEXRLoader) : null

  return {
    scene,
    posTex,
    nrmTex,
    meta,
    isLoaded: !!(scene && posTex && nrmTex && meta)
  }
}