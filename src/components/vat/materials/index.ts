import * as THREE from 'three'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { VATMeta, VATMaterialControls, VATShaderOverrides } from '../types'
import { VAT_VERTEX_SHADER, VAT_FRAGMENT_SHADER } from '../shaders'
import { suppressCSMWarnings } from '../utils/suppressCSMWarnings'
export { createVATMaterial as createSimpleVATNodeMaterial } from './vatNodeMaterial'

// Suppress harmless CSM warnings when materials are created
suppressCSMWarnings()

// Create VAT material with custom shaders
export function createVATMaterial(
  posTex: THREE.Texture,
  nrmTex: THREE.Texture | null,
  envMap: THREE.Texture | null,
  meta: VATMeta,
  materialProps: VATMaterialControls,
  shaderOverrides?: VATShaderOverrides,
  customUniforms?: Record<string, any>
): CustomShaderMaterial {
  const texWidth = meta.textureWidth
  const texHeight = meta.textureHeight
  const texelSizeX = 1.0 / texWidth
  
  const uniforms = {
    uPosTex: { value: posTex },
    uNrmTex: { value: nrmTex },
    uFrame: { value: 0.0 },
    uFrames: { value: meta.frameCount },
    uTexW: { value: texWidth },
    uTexH: { value: texHeight },
    uTexelSizeX: { value: texelSizeX },
    uNormalsCompressed: { value: (meta.compressNormal ?? false) ? 1 : 0 },
    ...(customUniforms || {})
  }

  // Standard Three.js material properties
  const threeJsMaterialProps: any = {
    roughness: materialProps.roughness,
    metalness: materialProps.metalness,
    transmission: materialProps.transmission,
    thickness: materialProps.thickness,
    ior: materialProps.ior,
    clearcoat: materialProps.clearcoat,
    clearcoatRoughness: materialProps.clearcoatRoughness,
    reflectivity: materialProps.reflectivity,
    envMapIntensity: materialProps.envMapIntensity,
    sheen: materialProps.sheen,
    sheenRoughness: materialProps.sheenRoughness,
    sheenColor: new THREE.Color(materialProps.sheenColor),
    iridescence: materialProps.iridescence,
    iridescenceIOR: materialProps.iridescenceIOR,
    iridescenceThicknessRange: [materialProps.iridescenceThicknessMin, materialProps.iridescenceThicknessMax] as [number, number],
    attenuationDistance: materialProps.attenuationDistance,
    attenuationColor: new THREE.Color(materialProps.attenuationColor),
    bumpScale: materialProps.bumpScale,
  }

  // Handle extra properties like normalMap, envMap, etc. generically
  const materialPropsAny = materialProps as any
  
  // Handle normalMap and normalScale FIRST (before other properties)
  // This ensures proper initialization order
  if (materialPropsAny.normalMap instanceof THREE.Texture) {
    // Ensure normalScale exists before setting normalMap
    if (materialPropsAny.normalScale instanceof THREE.Vector2) {
      threeJsMaterialProps.normalScale = materialPropsAny.normalScale
    } else if (materialPropsAny.normalScale && typeof materialPropsAny.normalScale === 'object' && ('x' in materialPropsAny.normalScale || 'y' in materialPropsAny.normalScale)) {
      threeJsMaterialProps.normalScale = new THREE.Vector2(
        materialPropsAny.normalScale.x ?? 1,
        materialPropsAny.normalScale.y ?? 1
      )
    } else {
      threeJsMaterialProps.normalScale = new THREE.Vector2(1, 1)
    }
    threeJsMaterialProps.normalMap = materialPropsAny.normalMap
  }
  
  // Handle other extra properties
  for (const key in materialPropsAny) {
    // Skip if it's already in threeJsMaterialProps or is an internal VAT property
    if (key in threeJsMaterialProps) continue
    if (key === 'iridescenceThicknessMin' || key === 'iridescenceThicknessMax') continue
    if (key === 'normalMap' || key === 'normalScale') continue // Already handled above
    
    const value = materialPropsAny[key]
    if (value !== undefined) {
      // Handle Three.js types directly
      if (
        value instanceof THREE.Texture ||
        value instanceof THREE.Vector2 ||
        value instanceof THREE.Vector3 ||
        value instanceof THREE.Color
      ) {
        threeJsMaterialProps[key] = value
      }
      // Handle other primitives
      else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || Array.isArray(value)) {
        threeJsMaterialProps[key] = value
      }
    }
  }

  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    vertexShader: shaderOverrides?.vertexShader || VAT_VERTEX_SHADER,
    fragmentShader: shaderOverrides?.fragmentShader || VAT_FRAGMENT_SHADER,
    transparent: true,
    uniforms,
    envMap: envMap,
    side: THREE.DoubleSide,
    ...threeJsMaterialProps,
  })
}

// Create VAT depth material for shadow casting
export function createVATDepthMaterial(
  posTex: THREE.Texture,
  nrmTex: THREE.Texture | null,
  meta: VATMeta,
  shaderOverrides?: VATShaderOverrides,
  customUniforms?: Record<string, any>
): CustomShaderMaterial {
  const texWidth = meta.textureWidth
  const texHeight = meta.textureHeight
  const texelSizeX = 1.0 / texWidth
  
  // Default to delta mode if not specified (matches Unity shader behavior)
  const storeDelta = meta.storeDelta ?? true
  
  const uniforms = {
    uPosTex: { value: posTex },
    uNrmTex: { value: nrmTex },
    uFrame: { value: 0.0 },
    uFrames: { value: meta.frameCount },
    uTexW: { value: texWidth },
    uTexH: { value: texHeight },
    uTexelSizeX: { value: texelSizeX },
    uStoreDelta: { value: storeDelta ? 1 : 0 },
    uNormalsCompressed: { value: (meta.compressNormal ?? false) ? 1 : 0 },
    ...(customUniforms || {})
  }

  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshDepthMaterial,
    vertexShader: shaderOverrides?.depthVertexShader || shaderOverrides?.vertexShader || VAT_VERTEX_SHADER,
    uniforms,
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  })
}

