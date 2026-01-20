import * as THREE from 'three'
import React, { useRef, useEffect, useMemo } from 'react'
import { useControls } from 'leva'
import { useFrame } from '@react-three/fiber'
import CustomShaderMaterial from 'three-custom-shader-material/vanilla'
import { DEFAULT_VAT_MATERIAL, VATShaderOverrides, VATMeta } from './types'
import { calculateVATFrame } from './utils'
export { useFrameCompute } from './hooks/useFrameCompute'

/**
 * Shared Leva controls configuration
 */
const LEVA_MATERIAL_CONTROLS = {
  roughness: { value: 0.4, min: 0, max: 1, step: 0.01 },
  metalness: { value: 0.6, min: 0, max: 1, step: 0.01 },
  transmission: { value: 0, min: 0, max: 1, step: 0.01 },
  thickness: { value: 0, min: 0, max: 10, step: 0.1 },
  ior: { value: 1.5, min: 1, max: 2.5, step: 0.01 },
  clearcoat: { value: 0.1, min: 0, max: 1, step: 0.01 },
  clearcoatRoughness: { value: 0.1, min: 0, max: 1, step: 0.01 },
  reflectivity: { value: 0.5, min: 0, max: 1, step: 0.01 },
  envMapIntensity: { value: 1, min: 0, max: 2, step: 0.1 },
  bumpScale: { value: 1.0, min: 0, max: 1, step: 0.01 },
  sheen: { value: 0, min: 0, max: 1, step: 0.01 },
  sheenRoughness: { value: 0.1, min: 0, max: 1, step: 0.01 },
  sheenColor: '#3695ff',
  iridescence: { value: 0, min: 0, max: 1, step: 0.01 },
  iridescenceIOR: { value: 1.3, min: 1, max: 2.333, step: 0.01 },
  iridescenceThicknessMin: { value: 100, min: 0, max: 1000, step: 10 },
  iridescenceThicknessMax: { value: 400, min: 0, max: 1000, step: 10 },
  attenuationDistance: { value: Infinity, min: 0.01, max: 10, step: 0.01 },
  attenuationColor: '#ffffff',
} as const

/**
 * Properties that should be excluded from Leva controls (e.g., textures, complex objects)
 */
const EXCLUDE_FROM_LEVA = new Set([
  'normalMap',
  'map',
  'envMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'displacementMap',
  'bumpMap',
  'alphaMap',
])

/**
 * Check if a value is editable in Leva (not a texture or complex object)
 */
function isLevaEditable(value: any): boolean {
  if (value === null || value === undefined) return false
  if (value instanceof THREE.Texture) return false
  if (value instanceof THREE.Vector2 || value instanceof THREE.Vector3) return true // Can edit via object
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Check if it's a simple object with numeric properties (like Vector2)
    const keys = Object.keys(value)
    return keys.length > 0 && keys.every(k => typeof value[k] === 'number')
  }
  return typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
}

/**
 * Create Leva control config for a value
 */
function createLevaControl(value: any, existingControl?: any): any {
  if (value instanceof THREE.Vector2) {
    return {
      value: { x: value.x, y: value.y },
      ...(existingControl || {})
    }
  }
  if (typeof value === 'number') {
    return {
      value,
      min: existingControl?.min ?? 0,
      max: existingControl?.max ?? 10,
      step: existingControl?.step ?? 0.01,
    }
  }
  return { value, ...(existingControl || {}) }
}

/**
 * Hook for VAT material controls with Leva
 * Supports both standard VAT material controls and additional properties like normalMap, envMap, etc.
 */
export function useVATMaterialControls(
  label: string,
  materialConfig?: Partial<typeof DEFAULT_VAT_MATERIAL> & Record<string, any>
) {

  // Separate Leva-editable properties from non-editable ones (like textures)
  const { levaConfig, extraProps } = useMemo(() => {
    const levaConfig: Record<string, any> = { ...LEVA_MATERIAL_CONTROLS }
    const extraProps: Record<string, any> = {}

    if (materialConfig) {
      for (const [key, value] of Object.entries(materialConfig)) {
        // Skip if excluded from Leva
        if (EXCLUDE_FROM_LEVA.has(key)) {
          extraProps[key] = value
          continue
        }

        // If it's a standard control, merge the value
        if (key in LEVA_MATERIAL_CONTROLS) {
          const control = LEVA_MATERIAL_CONTROLS[key as keyof typeof LEVA_MATERIAL_CONTROLS]
          if (typeof control === 'object' && control !== null && 'value' in control) {
            levaConfig[key] = {
              ...control,
              value,
            }
          } else {
            levaConfig[key] = value
          }
        }
        // If it's editable and not a standard control, add it to Leva
        else if (isLevaEditable(value)) {
          if (value instanceof THREE.Vector2) {
            levaConfig[key] = createLevaControl(value)
          } else if (typeof value === 'number') {
            levaConfig[key] = createLevaControl(value)
          } else {
            levaConfig[key] = { value }
          }
          extraProps[key] = value // Keep original for non-Leva props
        }
        // Otherwise, it's a non-editable property (texture, etc.)
        else {
          extraProps[key] = value
        }
      }
    }

    return { levaConfig, extraProps }
  }, [materialConfig])

  const levaControls = useControls(label, levaConfig, { collapsed: true })

  // Create a stable reference for materialControls by serializing key values
  // This prevents infinite loops when materialControls is used as a dependency
  const materialControls = useMemo(() => {
    const base: Record<string, any> = { ...DEFAULT_VAT_MATERIAL, ...levaControls }
    
    // Convert Vector2 objects back from Leva format {x, y} to THREE.Vector2
    // This handles properties like normalScale that are editable in Leva
    for (const [key, value] of Object.entries(levaControls)) {
      if (value && typeof value === 'object' && 'x' in value && 'y' in value && !('z' in value)) {
        base[key] = new THREE.Vector2(value.x, value.y)
      }
    }

    // Merge in extra properties (textures, etc.) from materialConfig
    // Important: extraProps contains textures and other non-Leva properties
    // We merge extraProps AFTER base to preserve Leva control values
    const merged = { ...base, ...extraProps } as typeof DEFAULT_VAT_MATERIAL & Record<string, any>
    
    // Override with Leva values for properties that are in Leva (prioritize Leva updates)
    // This ensures that when Leva controls change, they take precedence over extraProps
    for (const [key, value] of Object.entries(levaControls)) {
      if (value && typeof value === 'object' && 'x' in value && 'y' in value && !('z' in value)) {
        merged[key] = new THREE.Vector2(value.x, value.y)
      } else if (key in base) {
        merged[key] = base[key]
      }
    }
    
    return merged
  }, [levaControls, extraProps])

  return materialControls
}

/**
 * Hook to create a stable shader code key that only changes when shader CODE changes
 */
export function useShaderCodeKey(shaders?: VATShaderOverrides): string {
  const vertexShaderCode = shaders?.vertexShader
  const fragmentShaderCode = shaders?.fragmentShader
  const depthVertexShaderCode = shaders?.depthVertexShader

  return useMemo(() => {
    return `${vertexShaderCode || ''}|${fragmentShaderCode || ''}|${depthVertexShaderCode || ''}`
  }, [vertexShaderCode, fragmentShaderCode, depthVertexShaderCode])
}

/**
 * Hook to stabilize a ref value (prevents unnecessary recreations)
 */
export function useStableRef<T>(value: T | undefined): React.MutableRefObject<T | undefined> {
  const ref = useRef<T | undefined>(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

/**
 * Hook to update custom uniforms on materials
 */
export function useUpdateCustomUniforms(
  materialsRef: React.MutableRefObject<CustomShaderMaterial[]>,
  customUniforms?: Record<string, any>
) {
  useEffect(() => {
    if (!customUniforms) return

    for (const material of materialsRef.current) {
      if (material.uniforms) {
        for (const [key, uniform] of Object.entries(customUniforms)) {
          if (material.uniforms[key] && uniform && typeof uniform === 'object' && 'value' in uniform) {
            const existingUniform = material.uniforms[key]
            const newValue = uniform.value

            // Handle THREE.Color
            if (newValue?.isColor && existingUniform.value?.isColor) {
              existingUniform.value.copy(newValue)
            }
            // Handle THREE.Vector3
            else if (newValue?.isVector3 && existingUniform.value?.isVector3) {
              existingUniform.value.copy(newValue)
            }
            // Handle THREE.Texture
            else if (newValue instanceof THREE.Texture) {
              existingUniform.value = newValue
            }
            // Handle primitive values (numbers, arrays, etc.)
            else {
              existingUniform.value = newValue
            }
          }
        }
        material.needsUpdate = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customUniforms])
}

/**
 * Properties that need special handling (conversion from primitives to Three.js types)
 */
const SPECIAL_PROPERTIES: Record<string, (value: any) => any> = {
  sheenColor: (value: string | THREE.Color) => value instanceof THREE.Color ? value : new THREE.Color(value),
  attenuationColor: (value: string | THREE.Color) => value instanceof THREE.Color ? value : new THREE.Color(value),
}

/**
 * Properties that should be excluded from material assignment (internal VAT properties)
 */
const EXCLUDED_PROPERTIES = new Set([
  'iridescenceThicknessMin',
  'iridescenceThicknessMax',
])

/**
 * General function to apply material properties with proper type handling
 */
function applyMaterialProperty(material: any, key: string, value: any): void {
  // Handle special property conversions
  if (SPECIAL_PROPERTIES[key]) {
    material[key] = SPECIAL_PROPERTIES[key](value)
    return
  }

  // Handle Three.js types that should be passed through directly
  if (
    value instanceof THREE.Texture ||
    value instanceof THREE.Vector2 ||
    value instanceof THREE.Vector3 ||
    value instanceof THREE.Color ||
    value instanceof THREE.Matrix4
  ) {
    material[key] = value
    return
  }

  // Handle primitives and arrays
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    Array.isArray(value)
  ) {
    material[key] = value
    return
  }

  // Handle objects that might need conversion (e.g., {x, y} -> Vector2)
  if (value && typeof value === 'object') {
    if (key === 'normalScale' && ('x' in value || 'y' in value)) {
      material[key] = new THREE.Vector2(value.x ?? 1, value.y ?? 1)
      return
    }
    // For other objects, try to assign directly
    material[key] = value
    return
  }

  // Default: assign directly
  material[key] = value
}

/**
 * Hook to update material properties from controls
 * Supports both standard VAT material controls and additional properties like normalMap, envMap, etc.
 */
export function useUpdateMaterialProperties(
  materialsRef: React.MutableRefObject<CustomShaderMaterial[]>,
  materialControls: typeof DEFAULT_VAT_MATERIAL & Record<string, any>
) {
  const prevKeyRef = useRef<string>('')
  const materialControlsRef = useRef(materialControls)
  
  // Create a serialization key from materialControls - automatically handles all properties
  const createKey = (controls: typeof materialControls): string => {
    const serializable: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(controls)) {
      if (EXCLUDED_PROPERTIES.has(key) || value instanceof THREE.Texture) continue
      
      if (value instanceof THREE.Vector2) {
        serializable[key] = [value.x, value.y]
      } else if (value instanceof THREE.Color) {
        serializable[key] = value.getHex()
      } else if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
        serializable[key] = [value.x, value.y]
      } else {
        serializable[key] = value
      }
    }
    
    return JSON.stringify(serializable)
  }
  
  useEffect(() => {
    const currentKey = createKey(materialControls)
    
    // Skip if nothing actually changed
    if (currentKey === prevKeyRef.current) {
      materialControlsRef.current = materialControls
      return
    }
    
    prevKeyRef.current = currentKey
    materialControlsRef.current = materialControls
    
    // Use requestAnimationFrame to ensure updates happen outside of render cycle
    const rafId = requestAnimationFrame(() => {
      for (const material of materialsRef.current) {
        if (!material || !material.uniforms) continue
        
        const materialAny = material as any
        
        // Ensure material is ready before updating
        if (!materialAny.isMeshPhysicalMaterial && !materialAny.isMaterial) continue
        
        const controls = materialControlsRef.current
        
        // Handle iridescenceThicknessRange specially (combine min/max)
        const iridescenceThicknessRange = [
          controls.iridescenceThicknessMin ?? 100,
          controls.iridescenceThicknessMax ?? 400
        ]
        materialAny.iridescenceThicknessRange = iridescenceThicknessRange
        
        // Handle normalScale - only update if normalMap exists
        if (controls.normalScale !== undefined && materialAny.normalMap) {
          const normalScale = controls.normalScale instanceof THREE.Vector2 
            ? controls.normalScale 
            : (controls.normalScale && typeof controls.normalScale === 'object' && ('x' in controls.normalScale || 'y' in controls.normalScale))
              ? new THREE.Vector2(
                  (controls.normalScale as any)?.x ?? 1,
                  (controls.normalScale as any)?.y ?? 1
                )
              : new THREE.Vector2(1, 1)
          
          materialAny.normalScale = normalScale
        }
        
        // Apply all other properties generically
        for (const [key, value] of Object.entries(controls)) {
          // Skip excluded properties
          if (EXCLUDED_PROPERTIES.has(key)) continue
          if (key === 'iridescenceThicknessRange') continue     
          if (key === 'normalMap' || key === 'normalScale') continue
          
          // Skip undefined values
          if (value === undefined) continue
          
          // Apply property with proper type handling
          applyMaterialProperty(materialAny, key, value)
        }
        
        material.needsUpdate = true
      }
    })
    
    return () => {
      cancelAnimationFrame(rafId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialControls])
}

/**
 * Hook to update VAT frame uniform on each frame
 */
export function useVATFrame(
  materialsRef: React.MutableRefObject<CustomShaderMaterial[]>,
  metaData: VATMeta,
  vatSpeed: number,
  frameRatio: number | undefined,
  paused: boolean
) {
  useFrame((state) => {
    if (paused) return

    const frame = calculateVATFrame(frameRatio, state.clock.elapsedTime, metaData, vatSpeed)

    for (const material of materialsRef.current) {
      if (material.uniforms?.uFrame) {
        material.uniforms.uFrame.value = frame
      }
    }
  })
}
