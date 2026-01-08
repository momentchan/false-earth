import { useEffect } from 'react'
import * as THREE from 'three/webgpu'
import type { TerrainParams } from '../types'

interface UseGrassUniformsParams {
  grassParams: any
  terrainParams?: TerrainParams
  computeUniformsRef: React.MutableRefObject<Record<string, any>>
  materialUniformsRef: React.MutableRefObject<Record<string, any> | null>
  materialRef: React.MutableRefObject<THREE.MeshStandardNodeMaterial | null>
  materialLowRef: React.MutableRefObject<THREE.MeshStandardNodeMaterial | null>
}

export function useGrassUniforms({
  grassParams,
  terrainParams,
  computeUniformsRef,
  materialUniformsRef,
  materialRef,
  materialLowRef,
}: UseGrassUniformsParams) {
  useEffect(() => {
    if (!computeUniformsRef.current) return

    const params = grassParams as any
    const uniforms = computeUniformsRef.current

    // Update shape parameter uniforms from Leva controls
    uniforms.uBladeHeightMin.value = params.bladeHeightMin
    uniforms.uBladeHeightMax.value = params.bladeHeightMax
    uniforms.uBladeWidthMin.value = params.bladeWidthMin
    uniforms.uBladeWidthMax.value = params.bladeWidthMax
    uniforms.uBendAmountMin.value = params.bendAmountMin
    uniforms.uBendAmountMax.value = params.bendAmountMax
    uniforms.uBladeRandomness.value.set(
      params.bladeRandomness.x,
      params.bladeRandomness.y,
      params.bladeRandomness.z
    )

    // Update clump parameter uniforms
    uniforms.uClumpSize.value = params.clumpSize
    uniforms.uClumpRadius.value = params.clumpRadius
    uniforms.uCenterYaw.value = params.centerYaw
    uniforms.uBladeYaw.value = params.bladeYaw
    uniforms.uClumpYaw.value = params.clumpYaw
    uniforms.uTypeTrendScale.value = params.typeTrendScale

    // Update wind parameter uniforms (compute shader only has these)
    uniforms.uWindScale.value = params.windScale ?? 0.25
    uniforms.uWindSpeed.value = params.windSpeed
    uniforms.uWindStrength.value = params.windStrength
    uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
    uniforms.uWindFacing.value = params.windFacing
    
    // Update LOD parameter uniforms
    if (uniforms.uLODDistance) {
      uniforms.uLODDistance.value = params.lodDistance ?? 15.0
    }

    // Update material wind parameter uniforms (vertex shader has these additional ones)
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uWindDir.value.set(params.windDirX, params.windDirZ)
      materialUniformsRef.current.uWindSwayFreqMin.value = params.swayFreqMin
      materialUniformsRef.current.uWindSwayFreqMax.value = params.swayFreqMax
      materialUniformsRef.current.uWindSwayStrength.value = params.swayStrength
      materialUniformsRef.current.uWindDistanceStart.value = params.windDistanceStart
      materialUniformsRef.current.uWindDistanceEnd.value = params.windDistanceEnd
    }

    // Update material properties (both High and Low detail materials)
    if (materialRef.current) {
      materialRef.current.roughness = params.roughness
      materialRef.current.metalness = params.metalness
      if (params.emissive) {
        materialRef.current.emissive = new THREE.Color(params.emissive)
      }
      materialRef.current.envMapIntensity = params.envMapIntensity
    }
    
    // Update Low detail material properties (same values as High detail)
    if (materialLowRef.current) {
      materialLowRef.current.roughness = params.roughness
      materialLowRef.current.metalness = params.metalness
      if (params.emissive) {
        materialLowRef.current.emissive = new THREE.Color(params.emissive)
      }
      materialLowRef.current.envMapIntensity = params.envMapIntensity
    }

    // Update material width shaping uniforms
    if (materialUniformsRef.current) {
      materialUniformsRef.current.uMidSoft.value = params.midSoft
      materialUniformsRef.current.uRimPos.value = params.rimPos
      materialUniformsRef.current.uRimSoft.value = params.rimSoft

      // Update color uniforms
      const baseColor = new THREE.Color(params.baseColor)
      materialUniformsRef.current.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b)

      const tipColor = new THREE.Color(params.tipColor)
      materialUniformsRef.current.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b)

      const groundColor = terrainParams?.color || '#1a3319'
      const groundColorObj = new THREE.Color(groundColor)
      materialUniformsRef.current.uGroundColor.value.set(groundColorObj.r, groundColorObj.g, groundColorObj.b)

      materialUniformsRef.current.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y)
      materialUniformsRef.current.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y)
      materialUniformsRef.current.uAOPower.value = params.aoPower

      // Update lighting uniforms
      materialUniformsRef.current.uLightBackStrength.value = params.backLightStrength

      // Update noise uniforms
      materialUniformsRef.current.uNoiseParams.value.set(
        params.noiseFreqX,
        params.noiseFreqY,
        params.noiseRemapMin,
        params.noiseRemapMax
      )
    }
  }, [grassParams, terrainParams, computeUniformsRef, materialUniformsRef, materialRef, materialLowRef])
}

