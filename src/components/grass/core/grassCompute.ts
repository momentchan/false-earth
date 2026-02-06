// src/components/grass/core/grassCompute.ts

import {
  Fn,
  vec2,
  vec3,
  vec4,
  fract,
  sin,
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
  atomicAdd,
  atomicStore,
  abs,
} from "three/tsl";

import { uWindDir, uWindScale, uWindSpeed, uWindStrength, uWindFacing } from "../../../core/shaders/uniforms";
import type { LODBufferConfig } from "./config";
import { calculateWindStrength, applyWindFacingAndNormalize } from "../../../core/shaders/windHelpers";
import { uTime } from "../../../core/shaders/uniforms";

export function createGrassCompute(
  grassData: ReturnType<typeof instancedArray>,
  positions: ReturnType<typeof instancedArray>,
  lodConfigs: LODBufferConfig[],
  uniforms: Record<string, any>
) {

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

  // [Optimization] Simplified Frustum Culling
  // Uses 1 matrix mult (Point + Radius) instead of 2 (Box)
  const performCulling = Fn(([worldPos]: [any]) => {
    const radius = float(1.5);
    const viewProjMatrix = uniforms.uViewProjectionMatrix;
    // We manually construct vec4 to avoid overhead
    const clipPos = viewProjMatrix.mul(vec4(worldPos.x, worldPos.y, worldPos.z, float(1.0)));

    const isInFront = clipPos.w.greaterThan(radius.negate());
    // Optimized: check X/Y/Z against W+Radius without division
    const xIn = abs(clipPos.x).lessThan(clipPos.w.add(radius));
    const yIn = abs(clipPos.y).lessThan(clipPos.w.add(radius));
    const zIn = clipPos.z.lessThan(clipPos.w.add(radius));

    const inFrustum = isInFront.and(xIn).and(yIn).and(zIn);

    const isInCircle = length(worldPos.sub(uniforms.uGroupOffset)).lessThan(uniforms.uGrassAreaSize.mul(0.5));

    return inFrustum.and(isInCircle);
  });

  const computeFn = Fn(() => {
    const bladeRandX = uniforms.uBladeRandomness.x;
    const bladeRandY = uniforms.uBladeRandomness.y;
    const bladeRandZ = uniforms.uBladeRandomness.z;

    // --- Voronoi Helper (Only runs if visible) ---
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

    // [Optimization] Bitwise Indexing for Grid Position
    // Replaces slow float division. Assumes 1024 blades per axis (2^10).
    // This allows instant calculation of grid coordinates.
    const BLADES_PER_AXIS = float(1024.0); // Make sure this matches config

    const calculateJitteredPosition = Fn(([idx]: [any]) => {
      const uIdx = uint(idx);
      const iGridX = uIdx.shiftRight(uint(10)); // idx / 1024
      const iGridZ = uIdx.bitAnd(uint(1023));   // idx % 1024
      const gridX = float(iGridX);
      const gridZ = float(iGridZ);

      const grassAreaSize = uniforms.uGrassAreaSize;
      const fx = gridX.div(BLADES_PER_AXIS).sub(0.5);
      const fz = gridZ.div(BLADES_PER_AXIS).sub(0.5);
      const px = fx.mul(grassAreaSize);
      const pz = fz.mul(grassAreaSize);
      const instancePosRaw = vec3(px, float(0.0), pz);

      const worldPosRaw = instancePosRaw.add(uniforms.uGroupOffset);

      // Stable World Grid Calculation
      const worldGridX = floor(worldPosRaw.x.div(uniforms.uGridCellSize));
      const worldGridZ = floor(worldPosRaw.z.div(uniforms.uGridCellSize));

      // [Optimization] Fast Integer Hash Seed Construction
      // Create a unique integer ID for this cell to prevent float jitter
      const seedInt = uint(abs(worldGridX)).mul(uint(100000)).add(uint(abs(worldGridZ)));

      // Use Fast Hash for Jitter
      // Note: Jitter currently set to 0.0 (mul(0)) for maximum stability as per your code.
      // If you want jitter, change mul(0) to mul(1.0)
      const jitterX = fastHash(seedInt).sub(0.5).mul(0);
      const jitterZ = fastHash(seedInt.add(uint(1337))).sub(0.5).mul(0);

      const instancePosLocal = vec3(
        instancePosRaw.x.add(jitterX),
        instancePosRaw.y,
        instancePosRaw.z.add(jitterZ)
      );

      return instancePosLocal.add(uniforms.uGroupOffset);
    });

    // 1. Calculate Position First (Cheap)
    const worldPos = calculateJitteredPosition(instanceIndex);
    positions.element(instanceIndex).assign(worldPos);

    const diff = worldPos.sub(uniforms.uCameraPosition);
    const distToCamera = length(diff);
    const isCloseEnough = abs(diff.x).add(abs(diff.z)).lessThan(float(3));
    const isVisible = isCloseEnough.or(performCulling(worldPos));

    // 4. [Optimization] Expensive Logic Block
    // Only run Voronoi/Wind/Params if the grass is actually visible
    If(isVisible, () => {
      const data = grassData.element(instanceIndex);
      const worldXZ = vec2(worldPos.x, worldPos.z);
      const safeWorldXZ = getSafeHashPos(worldXZ);

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
      const presence = blendFactor;

      const perBladeHash01 = hash11(dot(safeWorldXZ, vec2(37.0, 17.0)));
      const clumpSeed01 = hash11(dot(bestCellId, vec2(47.3, 61.7)));

      const baseAngle = calculateBaseAngle(toCenter, worldXZ, bestCellId, perBladeHash01, centerFactor);

      const windStrength = calculateWindStrength(worldXZ, uWindDir, uWindScale, uTime, uWindSpeed, uWindStrength);
      const facingAngle01 = applyWindFacingAndNormalize(baseAngle, windStrength, uWindDir, uWindFacing);

      // Write Data
      data.get("bladeHeight").assign(bladeParams.height);
      data.get("bladeWidth").assign(bladeParams.width);
      data.get("bladeBend").assign(bladeParams.bend);
      data.get("bladeType").assign(bladeParams.type);
      data.get("toCenter").assign(toCenter);
      data.get("presence").assign(presence);
      data.get("clumpSeed01").assign(clumpSeed01);
      data.get("facingAngle01").assign(facingAngle01);
      data.get("perBladeHash01").assign(perBladeHash01);
      data.get("windStrength01").assign(windStrength);

      // 5. Assign LOD
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