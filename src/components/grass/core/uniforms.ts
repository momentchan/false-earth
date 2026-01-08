import * as THREE from 'three/webgpu'

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
  uniforms.uClumpRadius.value = params.clumpRadius
  uniforms.uCenterYaw.value = params.centerYaw
  uniforms.uBladeYaw.value = params.bladeYaw
  uniforms.uClumpYaw.value = params.clumpYaw
  uniforms.uTypeTrendScale.value = params.typeTrendScale

  // Wind parameters
  uniforms.uWindScale.value = params.windScale ?? 0.25
  uniforms.uWindSpeed.value = params.windSpeed
  uniforms.uWindStrength.value = params.windStrength
  uniforms.uWindDir.value.set(params.windDirX, params.windDirZ)
  uniforms.uWindFacing.value = params.windFacing

  // Culling parameters
  uniforms.uCullOffset.value = params.bladeHeightMax ?? 0.8
}

/**
 * Updates only material uniforms (not material properties like roughness/metalness)
 * Used for shared uniforms across multiple LOD materials
 */
export function updateMaterialUniforms(
  uniforms: Record<string, any>,
  grassParams: any,
  terrainUniforms?: { uTerrainAmp: any; uTerrainFreq: any; uTerrainSeed: any; uColor: any }
) {
  const params = grassParams as any;

  // Wind parameters
  uniforms.uWindDir.value.set(params.windDirX, params.windDirZ);
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

  if (terrainUniforms?.uColor) {
    const colorVec = terrainUniforms.uColor.value;
    uniforms.uGroundColor.value.set(colorVec.x, colorVec.y, colorVec.z);
  } 

  uniforms.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y);
  uniforms.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y);
  uniforms.uAOPower.value = params.aoPower;

  // Lighting uniforms
  uniforms.uLightBackStrength.value = params.backLightStrength;
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

  // Terrain uniforms
  // if (terrainParams) {
  //   uniforms.uTerrainAmp.value = terrainParams.amplitude;
  //   uniforms.uTerrainFreq.value = terrainParams.frequency;
  //   uniforms.uTerrainSeed.value = terrainParams.seed;
  // }
}

