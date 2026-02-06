// src/components/grass/core/grassCompute.ts

import {
  Fn,
  vec2,
  vec3,
  vec4,
  fract,
  sin,
  cos,
  mul,
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
import { DEFAULT_GRASS_AREA_SIZE, DEFAULT_GRID_DIVISIONS, DEFAULT_BLADES_PER_AXIS } from "./config";
import { calculateWindStrength, applyWindFacingAndNormalize } from "../../../core/shaders/windHelpers";
import { getTerrainHeight, getTerrainNormal } from "../../../core/shaders/terrainHelpers";

export function createGrassCompute(
  grassData: ReturnType<typeof instancedArray>,
  lodConfigs: LODBufferConfig[],
  uniforms: Record<string, any>
) {

  // Constants imported from config
  const BLADES_PER_AXIS = float(DEFAULT_BLADES_PER_AXIS);
  const GRASS_AREA_SIZE = float(DEFAULT_GRASS_AREA_SIZE);
  const GRID_CELL_SIZE = float(DEFAULT_GRASS_AREA_SIZE / DEFAULT_GRID_DIVISIONS);

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

  const DOMAIN_WRAP = float(32.0);
  const getSafeHashPos = (pos: any) => vec2(abs(pos.x).mod(DOMAIN_WRAP), abs(pos.y).mod(DOMAIN_WRAP));

  // [Optimization] Fast Integer Hash
  // Replaces sin/fract to prevent jitter at large coordinates during snapping
  const fastHash = Fn(([uInput]: [any]) => {
    const u = uint(uInput); // Cast input to uint directly
    let h = u.mul(uint(0x74779649));
    h = h.bitXor(h.shiftRight(uint(16)));
    h = h.mul(uint(0x27d4eb2d));
    h = h.bitXor(h.shiftRight(uint(15)));
    h = h.mul(uint(0x5851f42d));
    return float(h).div(float(0xffffffff));
  });

  const hash11 = (x: any) => fract(mul(sin(mul(x, 37.0)), 43758.5453123));

  const hash21 = (p: any) => {
    const h1 = hash11(dot(p, vec2(127.1, 311.7)));
    const h2 = hash11(dot(p, vec2(269.5, 183.3)));
    return vec2(h1, h2);
  };

  const hash2 = (p: any) => {
    const x = dot(p, vec2(127.1, 311.7));
    const y = dot(p, vec2(269.5, 183.3));
    return fract(sin(vec2(x, y)).mul(43758.5453));
  };

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

    const getClumpInfo = (worldXZ: any) => {
      const cell = worldXZ.div(uniforms.uClumpSize);
      const i_base = floor(cell);
      const f_base = fract(cell);

      const minD2_1 = float(1e9).toVar();
      const minD2_2 = float(1e9).toVar();

      const bestCellId = vec2(0.0).toVar();
      const secondBestCellId = vec2(0.0).toVar();
      const bestDiff = vec2(0.0).toVar();

      // 9-tap neighbor search
      const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
      ];

      offsets.forEach(([x, y]) => {
        const neighbor = vec2(float(x), float(y));
        const currentCellId = getSafeHashPos(i_base.add(neighbor));

        const seed = hash2(currentCellId);
        const diff = neighbor.add(seed).sub(f_base);
        const d2 = dot(diff, diff);

        If(d2.lessThan(minD2_1), () => {
          minD2_2.assign(minD2_1);
          secondBestCellId.assign(bestCellId);

          minD2_1.assign(d2);
          bestCellId.assign(currentCellId);
          bestDiff.assign(diff);
        }).ElseIf(d2.lessThan(minD2_2), () => {
          minD2_2.assign(d2);
          secondBestCellId.assign(currentCellId);
        });
      });

      const d1 = sqrt(minD2_1);
      const d2 = sqrt(minD2_2);
      const smoothness = uniforms.uClumpBlendSmoothness ?? float(0.2);

      const centerFactor = smoothstep(float(0.0), smoothness, d2.sub(d1));
      const toCenter = bestDiff.mul(uniforms.uClumpSize);

      return { toCenter, bestCellId, secondBestCellId, centerFactor };
    };

    const getClumpParams = (cellId: any) => {
      const c1 = hash21(cellId.mul(11.0));
      const c2 = hash21(cellId.mul(23.0));
      const clumpBaseHeight = mix(uniforms.uBladeHeightMin, uniforms.uBladeHeightMax, c1.x);
      const clumpBaseWidth = mix(uniforms.uBladeWidthMin, uniforms.uBladeWidthMax, c1.y);
      const clumpBaseBend = mix(uniforms.uBendAmountMin, uniforms.uBendAmountMax, c2.x);
      const type = c2.y;
      return { height: clumpBaseHeight, width: clumpBaseWidth, bend: clumpBaseBend, type: type };
    };

    const getBladeParams = (seed: any, clumpParams: any) => {
      const h1 = hash21(seed.mul(13.0));
      const h2 = hash21(seed.mul(29.0));
      const height = clumpParams.height.mul(mix(oneMinus(bladeRandX), float(1.0).add(bladeRandX), h1.x));
      const width = clumpParams.width.mul(mix(oneMinus(bladeRandY), float(1.0).add(bladeRandY), h1.y));
      const bend = clumpParams.bend.mul(mix(oneMinus(bladeRandZ), float(1.0).add(bladeRandZ), h2.x));
      const type = clumpParams.type;
      return { height, width, bend, type };
    };

    const calculateBaseAngle = (toCenter: any, _worldXZ: any, cellId: any, perBladeHash01: any, centerFactor: any) => {
      const clumpAngle = atan(toCenter.y, toCenter.x).mul(uniforms.uCenterYaw).mul(centerFactor);
      const randomOffset = perBladeHash01.sub(0.5).mul(uniforms.uBladeYaw);
      const clumpHash = hash11(dot(cellId, vec2(97.7, 3.1)));
      const clumpYaw = clumpHash.sub(0.5).mul(uniforms.uClumpYaw).mul(centerFactor);
      return clumpAngle.add(randomOffset).add(clumpYaw);
    };

    // Grid Position Calculation
    const calculateJitteredPosition = Fn(([idx]: [any]) => {
      const uIdx = uint(idx);
      const uWidth = uint(DEFAULT_BLADES_PER_AXIS);

      const iGridX = uIdx.div(uWidth);
      const iGridZ = uIdx.mod(uWidth);
      const gridX = float(iGridX);
      const gridZ = float(iGridZ);

      const fx = gridX.div(BLADES_PER_AXIS).sub(0.5);
      const fz = gridZ.div(BLADES_PER_AXIS).sub(0.5);
      const px = fx.mul(GRASS_AREA_SIZE);
      const pz = fz.mul(GRASS_AREA_SIZE);
      const instancePosRaw = vec3(px, float(0.0), pz);

      const worldPosRaw = instancePosRaw.add(uniforms.uGroupOffset);

      const worldGridX = floor(worldPosRaw.x.div(GRID_CELL_SIZE));
      const worldGridZ = floor(worldPosRaw.z.div(GRID_CELL_SIZE));

      const seedInt = uint(abs(worldGridX)).mul(uint(100000)).add(uint(abs(worldGridZ)));

      const jitterX = fastHash(seedInt).sub(0.5).mul(1);
      const jitterZ = fastHash(seedInt.add(uint(1337))).sub(0.5).mul(1);

      const instancePosLocal = vec3(
        instancePosRaw.x.add(jitterX),
        instancePosRaw.y,
        instancePosRaw.z.add(jitterZ)
      );

      return instancePosLocal.add(uniforms.uGroupOffset);
    });

    const worldPos = calculateJitteredPosition(instanceIndex);

    const diff = worldPos.sub(uniforms.uCameraPosition);
    const distToCamera = length(diff);
    const isCloseEnough = abs(diff.x).add(abs(diff.z)).lessThan(float(3));
    const isVisible = isCloseEnough.or(performCulling(worldPos));

    If(isVisible, () => {
      const worldXZ = vec2(worldPos.x, worldPos.z);
      const safeWorldXZ = getSafeHashPos(worldXZ);

      // Terrain height and normal
      const terrainHeightFn = getTerrainHeight(uTerrainAmp, uTerrainFreq, uTerrainSeed);
      const th = terrainHeightFn(worldXZ);
      const tn = getTerrainNormal(terrainHeightFn)(worldXZ);
      const finalPos = vec3(worldPos.x, worldPos.y.add(th), worldPos.z);

      // Voronoi / clumping
      const { toCenter, bestCellId, secondBestCellId, centerFactor } = getClumpInfo(worldXZ);
      const blendFactor = mix(float(0.5), float(1.0), centerFactor);
      const params1 = getClumpParams(bestCellId);
      const params2 = getClumpParams(secondBestCellId);
      const clumpParams = {
        height: mix(params2.height, params1.height, blendFactor),
        width: mix(params2.width, params1.width, blendFactor),
        bend: mix(params2.bend, params1.bend, blendFactor),
        type: params1.type
      };
      const bladeParams = getBladeParams(safeWorldXZ, clumpParams);

      // Seeds
      const perBladeHash01 = hash11(dot(safeWorldXZ, vec2(37.0, 17.0)));
      const clumpSeed01 = hash11(dot(bestCellId, vec2(47.3, 61.7)));

      // Wind
      const windStrength01 = calculateWindStrength(worldXZ, uWindDir, uWindScale, uTime, uWindSpeed, uWindStrength);
      const baseAngle = calculateBaseAngle(toCenter, worldXZ, bestCellId, perBladeHash01, centerFactor);
      const facingAngle01 = applyWindFacingAndNormalize(baseAngle, windStrength01, uWindDir, uWindFacing);
      const angleRad = facingAngle01.mul(6.28318);
      const rotSin = sin(angleRad);
      const rotCos = cos(angleRad);

      // Character interaction: compute push vector once per blade (saves length/div per vertex)
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
      data.get("data0").assign(vec4(finalPos, bladeParams.type));
      data.get("data1").assign(vec4(bladeParams.width, bladeParams.height, bladeParams.bend, windStrength01));
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