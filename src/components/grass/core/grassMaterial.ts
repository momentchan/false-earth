import * as THREE from "three/webgpu";
import {
  Fn,
  vec3,
  vec2,
  instancedArray,
  instanceIndex,
  cameraProjectionMatrix,
  cameraViewMatrix,
  cameraPosition,
  modelWorldMatrix,
  vec4,
  uv,
  float,
  normalize,
  select,
  floor,
  cross,
  pow,
  cos,
  sin,
  mix,
  dot,
  length,
  oneMinus,
  smoothstep,
  step,
  varying,
  abs,
  clamp,
  mul,
  transformNormalToView,
  faceDirection,
  pmremTexture,
  uniform,
  mx_noise_float,
  remapClamp,
  materialRoughness,
  materialEmissive,
  storage,
} from "three/tsl";

import {
  getTerrainHeight,
  getTerrainNormal,
} from "../../../core/shaders/terrainHelpers";
import {
  bezier3,
  bezier3Tangent,
} from "../../../core/shaders/mathHelpers";
import {
  getBezierControlPoints,
  getWindDirection,
  applyWindPush,
  applyVertexSway,
  applySlopeAlignment,
  applyViewDependentTilt,
  applyCharacterPush,
  createWaveLogic,
} from "./shaderHelpers";
import { waveStructure } from "../../cosmic/hooks/useCosmicWaves";
import { uTime, uWindDir, uTerrainAmp, uTerrainFreq, uTerrainSeed, uActiveWaveCount, GlobalWaveState, uGlobalHueShift } from "../../../core/shaders/uniforms";
import { shiftHSV } from "../../../core/shaders/colorHelper";

/**
 * Creates a grass material with vertex shader that scales blade geometry
 * based on computed blade width and height parameters
 */
export function createGrassMaterial(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  visibleIndicesBuffer: ReturnType<typeof instancedArray>,
  uniforms: Record<string, any>,
  lodDebugColor?: THREE.Color, // LOD debug color for visualization
) {

  // Define varyings for passing data from vertex to fragment
  const vGeoNormal = varying(vec3(0.0));
  const vHeight = varying(float(0.0));
  const vToCenter = varying(vec2(0.0));
  const vDistFade = varying(float(0.0));
  const vWorldPos = varying(vec3(0.0));
  const vSide = varying(vec3(0.0));
  const vClumpSeed = varying(float(0.0));
  const vBladeSeed = varying(float(0.0));
  const vCrackleNoise = varying(float(0.0));

  const near = 15;
  const far = 30;

  const material = new THREE.MeshStandardNodeMaterial();
  material.side = THREE.DoubleSide;

  // Terrain uniforms from core/shaders/uniforms
  const terrainAmp = uTerrainAmp;
  const terrainFreq = uTerrainFreq;
  const terrainSeed = uTerrainSeed;

  // LOD debug color uniform (for coloring different LODs)
  const uLodDebugColor = uniform(
    lodDebugColor
      ? vec3(lodDebugColor.r, lodDebugColor.g, lodDebugColor.b)
      : vec3(1.0, 1.0, 1.0) // Default white if not provided
  );

  const uGroupOffset = uniforms.uGroupOffset ?? uniform(new THREE.Vector3(0, 0, 0));
  const uCharacterWorldPos = uniforms.uCharacterWorldPos ?? uniform(new THREE.Vector3(0, 0, 0));

  // Wave: read from global state (useCosmicWaves publishes buffer; material created after scene mount so buffer exists)
  const waveBuffer = GlobalWaveState.buffer
    ? storage(GlobalWaveState.buffer, waveStructure, 16)
    : null;

  const calculateWaves = createWaveLogic(waveBuffer, uActiveWaveCount, uTime);

  const trueIndex = visibleIndicesBuffer.element(instanceIndex);
  const data = grassData.element(trueIndex);
  const instancePos = positions.element(trueIndex);

  const grassVertex = Fn(() => {
    // Terrain helper functions
    const terrainHeight = getTerrainHeight(
      terrainAmp,
      terrainFreq,
      terrainSeed
    );
    const terrainNormal = getTerrainNormal(terrainHeight);

    const width = data.get("bladeWidth").toConst();
    const height = data.get("bladeHeight").toConst();
    const bend = data.get("bladeBend").toConst();
    const bladeType = floor(data.get("bladeType").toConst().mul(3.0));

    const facingAngle = data.get("facingAngle01").toConst().mul(360);
    const angleRad = facingAngle.radians();
    const cosA = cos(angleRad);
    const sinA = sin(angleRad);
    const rotateFast = (v: any) =>
      vec2(v.x.mul(cosA).sub(v.y.mul(sinA)), v.x.mul(sinA).add(v.y.mul(cosA)));

    // Get wind strength and per-blade hash from compute shader
    const windStrength01 = data.get("windStrength01").toConst();
    const perBladeHash01 = data.get("perBladeHash01").toConst();

    const toCenter = data.get("toCenter").toConst();
    const clumpSeed01 = data.get("clumpSeed01").toConst();

    // instancePos is already in world space (stored from compute shader)
    const worldBasePos = instancePos;

    // Get world XZ position for wind calculations (already in world space)
    const worldXZ = vec2(worldBasePos.x, worldBasePos.z);

    // Calculate terrain height and normal
    const th = terrainHeight(worldXZ);
    const tn = terrainNormal(worldXZ);

    const dist = length(cameraPosition.sub(worldBasePos));

    // Calculate wind distance falloff (1.0 = full wind at near, 0.0 = no wind at far)
    // If uWindDistanceEnd is not set (0), use full wind strength
    const windDistanceFalloff = select(
      uniforms.uWindDistanceEnd.greaterThan(float(0.0)),
      oneMinus(
        smoothstep(uniforms.uWindDistanceStart, uniforms.uWindDistanceEnd, dist)
      ),
      float(1.0)
    );
    const windStrength = windStrength01.mul(windDistanceFalloff);

    // Get UV coordinates
    const uvCoords = uv();
    const t = uvCoords.y; // Position along blade (0 = base, 1 = tip)
    const s = uvCoords.x.sub(0.5).mul(2.0); // Side position (-1 to 1)

    // Bezier Control Points
    const p0 = vec3(0.0, 0.0, 0.0); // Base point
    let p3 = vec3(0.0, height, 0.0); // Tip point
    let { p1, p2 } = getBezierControlPoints(bladeType, height, bend);

    // Apply Wind Push (affects control points for overall blade push)
    const getWindDir = getWindDirection(uWindDir);
    const windPushed = applyWindPush(getWindDir)(p1, p2, p3, windStrength, height);
    p1 = windPushed.p1;
    p2 = windPushed.p2;
    p3 = windPushed.p3;

    // Apply Wave Push (affects control points for shockwave effects)
    // calculateWaves handles null waveBuffer internally, so we can always call it
    const waveEffects = calculateWaves(worldXZ);
    const waveForce = waveEffects.get('force');
    // Apply wave force to bezier control points (more effect at tip)
    p1.addAssign(waveForce.mul(float(0.3)));
    p2.addAssign(waveForce.mul(float(0.7)));
    p3.addAssign(waveForce.mul(float(1.2)));

    // Calculate spine (position along Bezier curve) and tangent
    const spine = bezier3(p0, p1, p2, p3, t);
    const tangent = normalize(bezier3Tangent(p0, p1, p2, p3, t));

    // Calculate side direction (perpendicular to tangent, used for blade width)
    const ref = vec3(0.0, 0.0, 1.0);
    const side = normalize(cross(ref, tangent));

    // Apply sin-like sway effect to vertices at top of blade
    const vertexSway = applyVertexSway(
      getWindDir,
      uTime,
      uniforms.uWindSwayFreqMin,
      uniforms.uWindSwayFreqMax,
      uniforms.uWindSwayStrength
    );
    const swayOffset = vertexSway(side, t, height, windStrength, perBladeHash01, worldXZ);
    const spineWithSway = spine.add(swayOffset);
    const normal = normalize(cross(side, tangent));

    const widthFactor = t
      .add(uniforms.uBaseWidth)
      .mul(pow(float(1.0).sub(t), uniforms.uTipThin));


    // Use spine with sway instead of original spine
    const lposBase = spineWithSway.add(side.mul(width).mul(widthFactor).mul(s));

    const lposXZ = rotateFast(vec2(lposBase.x, lposBase.z));
    let lpos = vec3(lposXZ.x, lposBase.y, lposXZ.y);

    lpos = applyCharacterPush(
      lpos,
      worldXZ,
      uCharacterWorldPos,
      t,
      uniforms.uCharacterPushRadius,
      uniforms.uCharacterPushAmount,
      uniforms.uCharacterFlattenAmount
    );

    const normalXZ = rotateFast(vec2(normal.x, normal.z));
    let normalRotated = vec3(normalXZ.x, normal.y, normalXZ.y);

    // Rotate side vector for fragment shader
    const sideXZ = rotateFast(vec2(side.x, side.z));
    let sideRotated = normalize(vec3(sideXZ.x, side.y, sideXZ.y));

    // Rotate tangent vector
    const tangentXZ = rotateFast(vec2(tangent.x, tangent.z));
    let tangentRotated = normalize(vec3(tangentXZ.x, tangent.y, tangentXZ.y));

    // Slope Alignment: Align the local "Up" vector (0,1,0) to the "Terrain Normal"
    applySlopeAlignment(tn, lpos, tangentRotated, sideRotated, normalRotated);

    const worldPos = vec3(
      instancePos.x.add(lpos.x),
      instancePos.y.add(lpos.y).add(th),
      instancePos.z.add(lpos.z)
    );

    const positionFinal = applyViewDependentTilt(
      lpos,
      worldPos,
      sideRotated,
      normalRotated,
      uvCoords,
      t,
      uniforms.uThicknessStrength,
      modelWorldMatrix,
      cameraPosition
    );

    // Calculate tilt delta in local space (from lpos)
    const tiltDelta = positionFinal.sub(lpos);
    // Transform tilt delta to world space and add to worldPos
    // Since parent group only has translation (no rotation), the delta direction is preserved
    const tiltDeltaWorld = modelWorldMatrix.mul(vec4(tiltDelta.x, tiltDelta.y, tiltDelta.z, float(0.0))).xyz;
    const worldPosFinal = worldPos.add(tiltDeltaWorld);
    const worldPosFinal4 = vec4(worldPosFinal.x, worldPosFinal.y, worldPosFinal.z, float(1.0));

    const noiseScale = float(2.0);
    const noisePos = worldPosFinal.mul(noiseScale);
    const movingNoisePos = vec3(noisePos.x, noisePos.y.sub(uTime.mul(2.0)), noisePos.z);

    vCrackleNoise.assign(mx_noise_float(movingNoisePos));
    vGeoNormal.assign(normalRotated);
    vHeight.assign(t);
    vToCenter.assign(toCenter);
    vDistFade.assign(smoothstep(float(near), float(far), dist));
    vWorldPos.assign(worldPosFinal);
    vSide.assign(sideRotated);
    vClumpSeed.assign(clumpSeed01);
    vBladeSeed.assign(perBladeHash01); 
    return worldPosFinal4;
  });

  material.positionNode = Fn(() => {
    const worldPos = grassVertex();
    return worldPos.sub(uGroupOffset);
  })();

  // Set normal node for PBR lighting
  material.normalNode = Fn(() => {
    // Width shaping (Rim + Midrib)
    const uvCoords = uv();
    const u = uvCoords.x.sub(0.5);
    const au = abs(u);

    const mid01 = smoothstep(uniforms.uMidSoft.negate(), uniforms.uMidSoft, u);
    const rimMask = smoothstep(
      uniforms.uRimPos,
      uniforms.uRimPos.add(uniforms.uRimSoft),
      au
    );
    const v01 = mix(mid01, oneMinus(mid01), rimMask);
    const ny = v01.mul(2.0).sub(1.0);

    const widthNormalStrength = float(0.35);
    const sideNorm = normalize(vSide);
    const baseNormal = normalize(vGeoNormal);
    const geoNormal = normalize(
      baseNormal.add(sideNorm.mul(ny).mul(widthNormalStrength))
    );

    // Transform to view space
    // Multiply by faceDirection to handle double-sided rendering correctly
    // faceDirection is 1.0 for front faces and -1.0 for back faces
    return transformNormalToView(geoNormal).mul(faceDirection);
  })();

  // Calculate AO factor (reusable across colorNode, roughnessNode, and envNode)
  const calculateAO = () => {
    return mix(
      float(0.35),
      float(1.0),
      clamp(pow(vHeight, uniforms.uAOPower), float(0.0), float(1.0))
    );
  };

  // Fragment shader for color calculation
  material.colorNode = Fn(() => {
    // Base Color (Height Gradient)
    const color = mix(uniforms.uBaseColor, uniforms.uTipColor, vHeight);
    
    // Color Layering
    const clumpSeedFactor = mix(uniforms.uClumpSeedRange.x, uniforms.uClumpSeedRange.y, vClumpSeed);
    const bladeSeedFactor = mix(uniforms.uBladeSeedRange.x, uniforms.uBladeSeedRange.y, vBladeSeed);
    let finalColor = color.mul(clumpSeedFactor).mul(bladeSeedFactor);

    // Height-based AO (reuse calculateAO)
    finalColor = finalColor.mul(calculateAO());

    // Distance-based Shading Simplification
    const grayValue = dot(finalColor, vec3(float(0.333)));
    const distFadeFactor = vDistFade.mul(float(0.35));
    finalColor = finalColor
      .mul(oneMinus(distFadeFactor))
      .add(vec3(grayValue).mul(distFadeFactor));


    const hueShifted = shiftHSV(finalColor, vec3(uGlobalHueShift, float(0.0), float(0.0)));
    return vec4(hueShifted, float(1.0));
  })();

  // Override roughness with AO effect: bottom (low AO) is rougher, top (high AO) is smoother
  material.roughnessNode = Fn(() => {
    const ao = calculateAO();
    // Base roughness from material property, modulated by AO
    const baseRoughness = materialRoughness;
    const roughnessMin = baseRoughness.mul(float(0.5));
    const roughnessMax = baseRoughness.mul(float(1));
    const roughness = mix(roughnessMax, roughnessMin, remapClamp(ao, float(0.35), float(1.0), float(0.0), float(1.0)));
    return clamp(roughness, float(0.0), float(1.0));
  })();

  material.envNode = Fn(() => {
    const envMap = material.envMap;
    if (envMap) {
      const ao = calculateAO();
      const envSample = pmremTexture(envMap).mul(ao);
      return envSample;
    }
    return vec3(0.0, 0.0, 0.0);
  })();

  material.emissiveNode = Fn(() => {
    const worldPosXZ = vec2(vWorldPos.x, vWorldPos.z);

    const waveEffects = calculateWaves(worldPosXZ);
    const baseStrength = waveEffects.get('strength');

    const isActive = step(float(0.001), baseStrength);

    // Height Gradient
    const heightFactor = smoothstep(float(0.0), float(1.0), vHeight);
    const tipGlow = heightFactor.mul(heightFactor);

    const electricCrackle = vCrackleNoise.mul(0.5).add(1.0);

    // Heat Color Ramp
    const coolColor = materialEmissive;
    const hotColor = mix(coolColor, vec3(1.0), float(0.8));
    const finalColor = mix(coolColor, hotColor, baseStrength.mul(baseStrength));

    const glow = baseStrength
      .mul(finalColor)
      .mul(tipGlow)
      .mul(electricCrackle)
      .mul(float(5.0)); // Boost intensity for Bloom 

    const hueShifted = shiftHSV(glow, vec3(uGlobalHueShift, float(0.0), float(0.0))); 

    return hueShifted.mul(isActive);
  })();


  // material.fragmentNode = Fn(() => {
  //   return vec4(uLodDebugColor, 1.0);
  //   const windStrength01 = data.get("windStrength01").toConst();
  //   return vec4(windStrength01, 0.0, 0.0, 1.0);
  //   return windStrength01;
  // })();

  return {
    material,
  };
}
