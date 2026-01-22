import * as THREE from 'three/webgpu'
import { DEFAULT_BLADES_PER_AXIS, DEFAULT_GRASS_AREA_SIZE, DEFAULT_GRID_DIVISIONS } from './constants'

/**
 * Updates compute shader uniforms from grass parameters
 */
export function updateComputeUniforms(uniforms: Record<string, any>, params: any) {
  // Shape parameters
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

  // Clump parameters
  uniforms.uClumpSize.value = params.clumpSize
  uniforms.uClumpBlendSmoothness.value = params.clumpBlendSmoothness ?? 0.2
  uniforms.uCenterYaw.value = params.centerYaw
  uniforms.uBladeYaw.value = params.bladeYaw
  uniforms.uClumpYaw.value = params.clumpYaw

  // Wind parameters are now managed globally via Wind component
  // Skip updating: uWindScale, uWindSpeed, uWindStrength, uWindDir, uWindFacing, uTime

  // Culling parameters
  uniforms.uCullOffset.value = params.bladeHeightMax ?? 0.8

  // LOD parameters
  uniforms.uLODNoiseScale.value = params.lodNoiseScale ?? 0.1

  uniforms.uBladesPerAxis.value = DEFAULT_BLADES_PER_AXIS
  uniforms.uGrassAreaSize.value = DEFAULT_GRASS_AREA_SIZE
  uniforms.uGridCellSize.value = DEFAULT_GRASS_AREA_SIZE / DEFAULT_GRID_DIVISIONS
}

/**
 * Updates only material uniforms (not material properties like roughness/metalness)
 * Used for shared uniforms across multiple LOD materials
 */
export function updateMaterialUniforms(
  uniforms: Record<string, any>,
  grassParams: any
) {
  const params = grassParams as any;

  // Wind parameters are now managed globally via Wind component
  // Skip updating: uWindDir, uTime
  uniforms.uWindSwayFreqMin.value = params.swayFreqMin;
  uniforms.uWindSwayFreqMax.value = params.swayFreqMax;
  uniforms.uWindSwayStrength.value = params.swayStrength;
  uniforms.uWindDistanceStart.value = params.windDistanceStart;
  uniforms.uWindDistanceEnd.value = params.windDistanceEnd;

  // Width shaping uniforms
  uniforms.uMidSoft.value = params.midSoft;
  uniforms.uRimPos.value = params.rimPos;
  uniforms.uRimSoft.value = params.rimSoft;

  // Color uniforms
  const baseColor = new THREE.Color(params.baseColor);
  uniforms.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b);

  const tipColor = new THREE.Color(params.tipColor);
  uniforms.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b);

  uniforms.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y);
  uniforms.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y);
  uniforms.uAOPower.value = params.aoPower;

  // Lighting uniforms
  uniforms.uBaseWidth.value = params.baseWidth ?? 0.35;
  uniforms.uTipThin.value = params.tipThin ?? 0.9;
  uniforms.uThicknessStrength.value = params.thicknessStrength ?? 0.02;

  // Noise uniforms
  uniforms.uNoiseParams.value.set(
    params.noiseFreqX,
    params.noiseFreqY,
    params.noiseRemapMin,
    params.noiseRemapMax
  );

  // Character push uniforms
  uniforms.uCharacterPushRadius.value = params.pushRadius ?? 0.8;
  uniforms.uCharacterPushAmount.value = params.pushAmount ?? 0.3;
  uniforms.uCharacterFlattenAmount.value = params.flattenAmount ?? 0.5;
}

