import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { useMemo } from 'react'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { TextureLoader } from 'three'
import { VATMeta } from './types'

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
