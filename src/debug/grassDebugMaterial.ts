import * as THREE from "three/webgpu";
import {
  Fn,
  vec3,
  vec2,
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
  mix,
  dot,
  length,
  oneMinus,
  smoothstep,
  step,
  sqrt,
  max,
  varying,
  abs,
  clamp,
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
  bezier3,
  bezier3Tangent,
} from "../../packages/three-core/src/utils/tsl/math";
import {
  getBezierControlPoints,
  getWindDirection,
  applyWindPush,
  applyVertexSway,
  applySlopeAlignment,
  applyViewDependentTilt,
  createWaveLogic,
} from "../components/grass/core/shaderHelpers";
import { waveStructure } from "../components/cosmic/hooks/useCosmicWaves";
import { uTime, uWindDir, uActiveWaveCount, GlobalWaveState, uGlobalHueShift } from "../core/shaders/uniforms";
import { shiftHSV } from "../../packages/three-core/src/utils/tsl/color";

export interface DebugBladeUniforms {
  uInstancePos: ReturnType<typeof uniform>;
  uBladeType: ReturnType<typeof uniform>;
  uWidth: ReturnType<typeof uniform>;
  uHeight: ReturnType<typeof uniform>;
  uBend: ReturnType<typeof uniform>;
  uWindStrength: ReturnType<typeof uniform>;
  uWindSwayStrength: ReturnType<typeof uniform>;
  uRotSin: ReturnType<typeof uniform>;
  uRotCos: ReturnType<typeof uniform>;
  uClumpSeed: ReturnType<typeof uniform>;
  uBladeSeed: ReturnType<typeof uniform>;
  uTerrainNormalXZ: ReturnType<typeof uniform>;
  uPushVector: ReturnType<typeof uniform>;
}

export function createDebugBladeUniforms(): DebugBladeUniforms {
  return {
    uInstancePos: uniform(new THREE.Vector3(0, 0, 0)),
    uBladeType: uniform(0.0),
    uWidth: uniform(0.04),
    uHeight: uniform(0.6),
    uBend: uniform(0.3),
    uWindStrength: uniform(0.0),
    uWindSwayStrength: uniform(0.0),
    uRotSin: uniform(0.0),
    uRotCos: uniform(1.0),
    uClumpSeed: uniform(0.5),
    uBladeSeed: uniform(0.5),
    uTerrainNormalXZ: uniform(new THREE.Vector2(0, 0)),
    uPushVector: uniform(new THREE.Vector2(0, 0)),
  };
}

/**
 * Same vertex/fragment logic as grassMaterial, but reads blade data from
 * plain uniforms instead of instanced storage buffers.
 * This allows rendering a single non-instanced blade for debugging.
 */
export function createGrassDebugMaterial(
  bladeUniforms: DebugBladeUniforms,
  materialUniforms: Record<string, any>,
) {
  const vGeoNormal = varying(vec3(0.0));
  const vHeight = varying(float(0.0));
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

  const uniforms = materialUniforms;

  const waveBuffer = GlobalWaveState.buffer
    ? storage(GlobalWaveState.buffer, waveStructure, 16)
    : null;

  const calculateWaves = createWaveLogic(waveBuffer, uActiveWaveCount, uTime);

  const grassVertex = Fn(() => {
    const instancePos = bladeUniforms.uInstancePos;
    const bladeType = floor(bladeUniforms.uBladeType.mul(3.0));
    const width = bladeUniforms.uWidth;
    const height = bladeUniforms.uHeight;
    const bend = bladeUniforms.uBend;
    const windStrength01 = bladeUniforms.uWindStrength;
    const rotSin = bladeUniforms.uRotSin;
    const rotCos = bladeUniforms.uRotCos;
    const clumpSeed01 = bladeUniforms.uClumpSeed;
    const perBladeHash01 = bladeUniforms.uBladeSeed;
    const tnX = bladeUniforms.uTerrainNormalXZ.x;
    const tnZ = bladeUniforms.uTerrainNormalXZ.y;
    const pushVector = bladeUniforms.uPushVector;
    const tnY = sqrt(max(float(0.0), float(1.0).sub(tnX.mul(tnX)).sub(tnZ.mul(tnZ))));
    const tn = vec3(tnX, tnY, tnZ);

    const rotateFast = (v: any) =>
      vec2(v.x.mul(rotCos).sub(v.y.mul(rotSin)), v.x.mul(rotSin).add(v.y.mul(rotCos)));

    const worldBasePos = instancePos;
    const worldXZ = vec2(worldBasePos.x, worldBasePos.z);

    const dist = length(cameraPosition.sub(worldBasePos));

    const windDistanceFalloff = select(
      uniforms.uWindDistanceEnd.greaterThan(float(0.0)),
      oneMinus(
        smoothstep(uniforms.uWindDistanceStart, uniforms.uWindDistanceEnd, dist)
      ),
      float(1.0)
    );
    const windStrength = windStrength01.mul(windDistanceFalloff);

    const uvCoords = uv();
    const t = uvCoords.y;
    const s = uvCoords.x.sub(0.5).mul(2.0);

    const p0 = vec3(0.0, 0.0, 0.0);
    let p3 = vec3(0.0, height, 0.0);
    let { p1, p2 } = getBezierControlPoints(bladeType, height, bend);

    const getWindDir = getWindDirection(uWindDir);
    const windPushed = applyWindPush(getWindDir)(p1, p2, p3, windStrength, height);
    p1 = windPushed.p1;
    p2 = windPushed.p2;
    p3 = windPushed.p3;

    const waveEffects = calculateWaves(worldXZ);
    const waveForce = waveEffects.get('force');
    p1.addAssign(waveForce.mul(float(0.3)));
    p2.addAssign(waveForce.mul(float(0.7)));
    p3.addAssign(waveForce.mul(float(1.2)));

    const spine = bezier3(p0, p1, p2, p3, t);
    const tangent = normalize(bezier3Tangent(p0, p1, p2, p3, t));

    const ref = vec3(0.0, 0.0, 1.0);
    const side = normalize(cross(ref, tangent));

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

    const widthFactor = t.add(uniforms.uBaseWidth).mul(pow(float(1.0).sub(t), uniforms.uTipThin));

    const lposBase = spineWithSway.add(side.mul(width).mul(widthFactor).mul(s));
    const lposXZ = rotateFast(vec2(lposBase.x, lposBase.z));
    let lpos = vec3(lposXZ.x, lposBase.y, lposXZ.y);

    const pushLen = length(pushVector);
    lpos = vec3(
      lpos.x.add(pushVector.x.mul(pow(t, float(2.0)))),
      lpos.y.mul(oneMinus(pushLen.mul(uniforms.uCharacterFlattenAmount).mul(t))),
      lpos.z.add(pushVector.y.mul(pow(t, float(2.0))))
    );

    const normalXZ = rotateFast(vec2(normal.x, normal.z));
    let normalRotated = vec3(normalXZ.x, normal.y, normalXZ.y);

    const sideXZ = rotateFast(vec2(side.x, side.z));
    let sideRotated = normalize(vec3(sideXZ.x, side.y, sideXZ.y));

    const tangentXZ = rotateFast(vec2(tangent.x, tangent.z));
    let tangentRotated = normalize(vec3(tangentXZ.x, tangent.y, tangentXZ.y));

    applySlopeAlignment(tn, lpos, tangentRotated, sideRotated, normalRotated);

    const worldPos = vec3(
      instancePos.x.add(lpos.x),
      instancePos.y.add(lpos.y),
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

    const tiltDelta = positionFinal.sub(lpos);
    const tiltDeltaWorld = modelWorldMatrix.mul(vec4(tiltDelta.x, tiltDelta.y, tiltDelta.z, float(0.0))).xyz;
    const worldPosFinal = worldPos.add(tiltDeltaWorld);
    const worldPosFinal4 = vec4(worldPosFinal.x, worldPosFinal.y, worldPosFinal.z, float(1.0));

    const noiseScale = float(2.0);
    const noisePos = worldPosFinal.mul(noiseScale);
    const movingNoisePos = vec3(noisePos.x, noisePos.y.sub(uTime.mul(2.0)), noisePos.z);

    vCrackleNoise.assign(mx_noise_float(movingNoisePos));
    vGeoNormal.assign(normalRotated);
    vHeight.assign(t);
    vDistFade.assign(smoothstep(float(near), float(far), dist));
    vWorldPos.assign(worldPosFinal);
    vSide.assign(sideRotated);
    vClumpSeed.assign(clumpSeed01);
    vBladeSeed.assign(perBladeHash01);
    return worldPosFinal4;
  });

  material.positionNode = Fn(() => {
    return grassVertex();
  })();

  material.normalNode = Fn(() => {
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

    return transformNormalToView(geoNormal).mul(faceDirection);
  })();

  const calculateAO = () => {
    return mix(
      float(0.35),
      float(1.0),
      clamp(pow(vHeight, uniforms.uAOPower), float(0.0), float(1.0))
    );
  };

  material.colorNode = Fn(() => {
    const color = mix(uniforms.uBaseColor, uniforms.uTipColor, vHeight);

    const clumpSeedFactor = mix(uniforms.uClumpSeedRange.x, uniforms.uClumpSeedRange.y, vClumpSeed);
    const bladeSeedFactor = mix(uniforms.uBladeSeedRange.x, uniforms.uBladeSeedRange.y, vBladeSeed);
    let finalColor = color.mul(clumpSeedFactor).mul(bladeSeedFactor);

    finalColor = finalColor.mul(calculateAO());

    const grayValue = dot(finalColor, vec3(float(0.333)));
    const distFadeFactor = vDistFade.mul(float(0.35));
    finalColor = finalColor
      .mul(oneMinus(distFadeFactor))
      .add(vec3(grayValue).mul(distFadeFactor));

    const hueShifted = shiftHSV(finalColor, vec3(uGlobalHueShift, float(0.0), float(0.0)));
    return vec4(hueShifted, float(1.0));
  })();

  material.roughnessNode = Fn(() => {
    const ao = calculateAO();
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

    const heightFactor = smoothstep(float(0.0), float(1.0), vHeight);
    const tipGlow = heightFactor.mul(heightFactor);

    const electricCrackle = vCrackleNoise.mul(0.5).add(1.0);

    const coolColor = materialEmissive;
    const hotColor = mix(coolColor, vec3(1.0), float(0.8));
    const finalColor = mix(coolColor, hotColor, baseStrength.mul(baseStrength));

    const glow = baseStrength
      .mul(finalColor)
      .mul(tipGlow)
      .mul(electricCrackle)
      .mul(float(5.0));

    const hueShifted = shiftHSV(glow, vec3(uGlobalHueShift, float(0.0), float(0.0)));

    return hueShifted.mul(isActive);
  })();

  return { material };
}
