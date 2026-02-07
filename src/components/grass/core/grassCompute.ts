// src/components/grass/core/grassCompute.ts

import {
  Fn,
  vec2,
  vec3,
  vec4,
  fract,
  sin,
  cos,
  dot,
  mix,
  instancedArray,
  instanceIndex,
  sqrt,
  length,
  atan,
  If,
  float,
  floor,
  round,
  int,
  uint,
  oneMinus,
  smoothstep,
  step,
  select,
  atomicAdd,
  atomicStore,
  abs,
} from "three/tsl";

import { uWindDir, uWindScale, uWindSpeed, uWindStrength, uWindFacing, uTime, uTerrainAmp, uTerrainFreq, uTerrainSeed } from "../../../core/shaders/uniforms";
import type { LODBufferConfig } from "./config";
import { DEFAULT_GRASS_AREA_SIZE, DEFAULT_BLADES_PER_AXIS } from "./config";
import { calculateWindStrength, applyWindFacingAndNormalize } from "../../../core/shaders/windHelpers";
import { getTerrainHeight, getTerrainNormal } from "../../../core/shaders/terrainHelpers";
import { hash2to1, hash2to2 } from "./shaderHelpers";

export function createGrassCompute(
  grassData: ReturnType<typeof instancedArray>,
  lodConfigs: LODBufferConfig[],
  uniforms: Record<string, any>
) {

  // Constants imported from config
  const BLADES_PER_AXIS = float(DEFAULT_BLADES_PER_AXIS);
  const GRASS_AREA_SIZE = float(DEFAULT_GRASS_AREA_SIZE);
  const BLADE_SPACING = float(DEFAULT_GRASS_AREA_SIZE / DEFAULT_BLADES_PER_AXIS);

  // Build LOD routing chain factory function
  const createLODRoutingChainBuilder = (configs: LODBufferConfig[]) => {
    return (distToCamera: any, instanceIndex: any) => {
      if (configs.length === 0) return;

      // Single LOD case
      if (configs.length === 1) {
        const config = configs[0];
        const lodIndex = atomicAdd(
          config.drawStorage.get("instanceCount"),
          uint(1)
        );
        config.indices.element(lodIndex).assign(uint(instanceIndex));
        return;
      }

      // Multi LOD chain builder
      const buildChain = (index: number): any => {
        if (index >= configs.length) return;

        const config = configs[index];
        const isLast = index === configs.length - 1;

        const minDist = float(config.minDistance);
        const maxDist = config.maxDistance === Infinity
          ? float(1e9)
          : float(config.maxDistance);

        // Add some noise to LOD transitions to prevent hard lines
        const noiseScale = uniforms.uLODNoiseScale;
        const noiseSeed = fract(float(instanceIndex).mul(0.12345)).mul(2.0).sub(1.0);
        const noiseOffset = distToCamera.mul(noiseScale).mul(noiseSeed);
        const noisyDist = distToCamera.add(noiseOffset);

        const inRange = noisyDist.greaterThanEqual(minDist).and(
          isLast || config.maxDistance === Infinity
            ? noisyDist.lessThanEqual(maxDist)
            : noisyDist.lessThan(maxDist)
        );

        const lodBlock = () => {
          const lodIndex = atomicAdd(
            config.drawStorage.get("instanceCount"),
            uint(1)
          );
          config.indices.element(lodIndex).assign(uint(instanceIndex));
        };

        if (isLast) {
          return If(inRange, lodBlock);
        } else {
          const nextChain = buildChain(index + 1);
          return If(inRange, lodBlock).Else(() => {
            if (nextChain) nextChain;
          });
        }
      };

      const chain = buildChain(0);
      if (chain) chain;
    };
  };

  const buildLODRouting = createLODRoutingChainBuilder(lodConfigs);

  const performCulling = Fn(([worldPos]: [any]) => {
    const radius = float(1.5);
    const viewProjMatrix = uniforms.uViewProjectionMatrix;
    const clipPos = viewProjMatrix.mul(vec4(worldPos.x, worldPos.y, worldPos.z, float(1.0)));

    const isInFront = clipPos.w.greaterThan(radius.negate());
    const xIn = abs(clipPos.x).lessThan(clipPos.w.add(radius));
    const yIn = abs(clipPos.y).lessThan(clipPos.w.add(radius));
    const zIn = clipPos.z.lessThan(clipPos.w.add(radius));

    const inFrustum = isInFront.and(xIn).and(yIn).and(zIn);

    const isInCircle = length(worldPos.sub(uniforms.uGroupOffset)).lessThan(GRASS_AREA_SIZE.mul(0.5));

    return inFrustum.and(isInCircle);
  });

  const computeFn = Fn(() => {
    const bladeRandX = uniforms.uBladeRandomness.x;
    const bladeRandY = uniforms.uBladeRandomness.y;
    const bladeRandZ = uniforms.uBladeRandomness.z;

    const calculateWorldPosition = (idx: any) => {
      const uIdx = uint(idx);
      const iGridX = uIdx.div( uint(DEFAULT_BLADES_PER_AXIS));
      const iGridZ = uIdx.mod( uint(DEFAULT_BLADES_PER_AXIS));
      const offsetStepsX = round(uniforms.uGridIndex.x);
      const offsetStepsZ = round(uniforms.uGridIndex.y);

      const globalGridX = int(iGridX).add(int(offsetStepsX));
      const globalGridZ = int(iGridZ).add(int(offsetStepsZ));

      const jitterRand = hash2to2(globalGridX, globalGridZ);
      const jitterScale = BLADE_SPACING.mul(float(1.0));
      const jitterX = jitterRand.x.sub(0.5).mul(jitterScale);
      const jitterZ = jitterRand.y.sub(0.5).mul(jitterScale);

      const gridX = float(iGridX);
      const gridZ = float(iGridZ);
      const fx = gridX.div(BLADES_PER_AXIS).sub(0.5);
      const fz = gridZ.div(BLADES_PER_AXIS).sub(0.5);
      const px = fx.mul(GRASS_AREA_SIZE);
      const pz = fz.mul(GRASS_AREA_SIZE);

      const instancePosRaw = vec3(px, float(0.0), pz);

      const worldPos = vec3(
        instancePosRaw.x.add(jitterX),
        instancePosRaw.y,
        instancePosRaw.z.add(jitterZ)
      ).add(uniforms.uGroupOffset);
      return { worldPos, globalGridX, globalGridZ };
    };

    const { worldPos, globalGridX, globalGridZ } = calculateWorldPosition(instanceIndex);

    const diff = worldPos.sub(uniforms.uCameraPosition);
    const distToCamera = length(diff);
    const isCloseEnough = abs(diff.x).add(abs(diff.z)).lessThan(float(3));
    const isVisible = isCloseEnough.or(performCulling(worldPos));

    If(isVisible, () => {
      const worldXZ = vec2(worldPos.x, worldPos.z);

      // Terrain
      const terrainHeightFn = getTerrainHeight(uTerrainAmp, uTerrainFreq, uTerrainSeed);
      const th = terrainHeightFn(worldXZ);
      const tn = getTerrainNormal(terrainHeightFn)(worldXZ);
      const finalPos = vec3(worldPos.x, worldPos.y.add(th), worldPos.z);

      // Voronoi / clumping
      const bladesPerClump = float(uniforms.uClumpSize).div(BLADE_SPACING);

      const getClumpInfo = (gx: any, gz: any) => {
        const cx = floor(float(gx).div(bladesPerClump));
        const cz = floor(float(gz).div(bladesPerClump));
        const minD2 = float(1e9).toVar();
        const secondMinD2 = float(1e9).toVar();
        const bestID = vec2(0.0).toVar();
        const secondBestID = vec2(0.0).toVar();
        const bestDiff = vec2(0.0).toVar();
        const fx = fract(float(gx).div(bladesPerClump));
        const fz = fract(float(gz).div(bladesPerClump));
        const currentPos = vec2(fx, fz);
        const offsets = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
        offsets.forEach(([ox, oy]) => {
          const neighborX = cx.add(float(ox));
          const neighborZ = cz.add(float(oy));
          const rand = hash2to2(int(neighborX), int(neighborZ));
          const point = vec2(float(ox), float(oy)).add(rand);
          const diff = point.sub(currentPos);
          const d2 = dot(diff, diff);
          If(d2.lessThan(minD2), () => {
            secondMinD2.assign(minD2);
            secondBestID.assign(bestID);
            bestDiff.assign(diff);
            minD2.assign(d2);
            bestID.assign(vec2(neighborX, neighborZ));
          }).ElseIf(d2.lessThan(secondMinD2), () => {
            secondMinD2.assign(d2);
            secondBestID.assign(vec2(neighborX, neighborZ));
          });
        });
        const d1 = sqrt(minD2);
        const d2 = sqrt(secondMinD2);
        const smoothness = uniforms.uClumpBlendSmoothness ?? float(0.2);
        const centerFactor = smoothstep(float(0.0), smoothness, d2.sub(d1));
        const toCenter = bestDiff.mul(uniforms.uClumpSize);
        return { bestID, secondBestID, centerFactor, toCenter };
      };

      const { bestID, secondBestID, centerFactor, toCenter } = getClumpInfo(globalGridX, globalGridZ);
      const blendFactor = mix(float(0.5), float(1.0), centerFactor);

      const getClumpParams = (idx: any, idy: any) => {
        const h1 = hash2to1(int(idx), int(idy));
        const h2 = hash2to1(int(idx).add(123), int(idy).add(456));
        const h3 = hash2to1(int(idx).add(789), int(idy).add(101));
        const h4 = hash2to1(int(idx).add(999), int(idy).add(999));
        const h = mix(uniforms.uBladeHeightMin, uniforms.uBladeHeightMax, h1);
        const w = mix(uniforms.uBladeWidthMin, uniforms.uBladeWidthMax, h2);
        const b = mix(uniforms.uBendAmountMin, uniforms.uBendAmountMax, h3);
        return { height: h, width: w, bend: b, type: h4 };
      };

      const p1 = getClumpParams(bestID.x, bestID.y);
      const p2 = getClumpParams(secondBestID.x, secondBestID.y);
      const height = mix(p2.height, p1.height, blendFactor);
      const width = mix(p2.width, p1.width, blendFactor);
      const bend = mix(p2.bend, p1.bend, blendFactor);
      const type = p1.type;

      const bladeRandSeed = hash2to1(globalGridX, globalGridZ);
      const bladeRandSeed2 = hash2to1(globalGridX.add(1), globalGridZ);
      const bladeRandSeed3 = hash2to1(globalGridX.add(2), globalGridZ);
      const finalHeight = height.mul(mix(oneMinus(bladeRandX), float(1.0).add(bladeRandX), bladeRandSeed));
      const finalWidth = width.mul(mix(oneMinus(bladeRandY), float(1.0).add(bladeRandY), bladeRandSeed2));
      const finalBend = bend.mul(mix(oneMinus(bladeRandZ), float(1.0).add(bladeRandZ), bladeRandSeed3));

      const perBladeHash01 = bladeRandSeed;
      const clumpSeed01 = hash2to1(int(bestID.x).add(47), int(bestID.y).add(31));
      const clumpHash = hash2to1(int(bestID.x), int(bestID.y));
      const baseAngle = atan(toCenter.y, toCenter.x).mul(uniforms.uCenterYaw).mul(centerFactor)
        .add(perBladeHash01.sub(0.5).mul(uniforms.uBladeYaw))
        .add(clumpHash.sub(0.5).mul(uniforms.uClumpYaw).mul(centerFactor));

      // Wind
      const windStrength01 = calculateWindStrength(worldXZ, uWindDir, uWindScale, uTime, uWindSpeed, uWindStrength);
      const facingAngle01 = applyWindFacingAndNormalize(baseAngle, windStrength01, uWindDir, uWindFacing);
      const angleRad = facingAngle01.mul(6.28318);
      const rotSin = sin(angleRad);
      const rotCos = cos(angleRad);

      // Character interaction
      const charXZ = vec2(uniforms.uCharacterWorldPos.x, uniforms.uCharacterWorldPos.z);
      const charDiff = worldXZ.sub(charXZ);
      const charDist = length(charDiff);
      const safeCharDir = select(
        charDist.lessThan(float(0.001)),
        vec2(0.0, 0.0),
        charDiff.div(charDist)
      );
      const pushFactor = smoothstep(uniforms.uCharacterPushRadius, float(0.0), charDist);
      const activePush = step(float(0.001), pushFactor);
      const finalPushStrength = pushFactor.mul(uniforms.uCharacterPushAmount).mul(activePush);
      const pushVector = safeCharDir.mul(finalPushStrength);

      const data = grassData.element(instanceIndex);
      data.get("data0").assign(vec4(finalPos, type));
      data.get("data1").assign(vec4(finalWidth, finalHeight, finalBend, windStrength01));
      data.get("data2").assign(vec4(rotSin, rotCos, clumpSeed01, perBladeHash01));
      data.get("data3").assign(vec4(tn.x, tn.z, pushVector.x, pushVector.y));

      buildLODRouting(distToCamera, instanceIndex);
    });
  });

  return {
    computeFn,
  };
}

export function createResetDrawBufferCompute(lodConfigs: LODBufferConfig[]) {
  const resetFn = Fn(() => {
    lodConfigs.forEach((lodConfig) => {
      const drawBuffer = lodConfig.drawStorage;
      drawBuffer.get("vertexCount").assign(uint(lodConfig.vertexCount));
      atomicStore(drawBuffer.get("instanceCount"), uint(0));
      drawBuffer.get("firstVertex").assign(uint(0));
      drawBuffer.get("firstInstance").assign(uint(0));
      drawBuffer.get("offset").assign(uint(0));
    });
  });

  return resetFn().compute(1);
}