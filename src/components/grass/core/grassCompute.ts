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
  cos,
  If,
  Loop,
  float,
  PI,
  TWO_PI,
  clamp,
  floor,
  uint,
  oneMinus,
  select,
  mx_fractal_noise_float,
  hash,
  smoothstep,
  remapClamp,
  atomicAdd,
  atomicStore,
  int,
  mx_noise_float,
  abs,
} from "three/tsl";
import type { LODBufferConfig } from "./types";
import { safeNormalize, normalizeAngle, calculateWindStrength, applyWindFacingAndNormalize } from "./windHelpers";

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
      if (configs.length === 1) {
        // Single LOD - no condition needed, just add to it
        const config = configs[0];
        const lodIndex = atomicAdd(
          config.drawStorage.get("instanceCount"),
          uint(1)
        );
        config.indices.element(lodIndex).assign(uint(instanceIndex));
        return;
      }

      // Build chain forwards: If(condition1, block1).Else(If(condition2, block2).Else(...))
      const buildChain = (index: number): any => {
        if (index >= configs.length) return;

        const config = configs[index];
        const isLast = index === configs.length - 1;

        // Check if distance falls within this LOD's range
        const minDist = float(config.minDistance);
        const maxDist =
          config.maxDistance === Infinity
            ? float(1e9) // Use a very large number for Infinity
            : float(config.maxDistance);

        const noiseScale = uniforms.uLODNoiseScale
        const noiseSeed = fract(float(instanceIndex).mul(0.12345)).mul(2.0).sub(1.0);
        const noiseOffset = distToCamera.mul(noiseScale).mul(noiseSeed);
        const noisyDist = distToCamera.add(noiseOffset);

        const inRange = noisyDist
          .greaterThanEqual(minDist)
          .and(
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

  // Create the routing chain builder at JavaScript time
  const buildLODRouting = createLODRoutingChainBuilder(lodConfigs);

  // Calculate distance to camera
  const calculateDistance = Fn(([worldPos]: [any]) => {
    const camPos = uniforms.uCameraPosition;
    return length(worldPos.sub(camPos));
  });

  const seededRandom = (seed: any) => {
    const x = mul(sin(seed), 10000.0);
    return fract(x);
  };

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


  // Perform frustum and distance culling with offset support
  const performCulling = Fn(([worldPos]: [any]) => {
    const worldPosBottom = worldPos;
    const worldPosTop = vec4(
      worldPosBottom.x,
      worldPosBottom.y.add(uniforms.uCullOffset),
      worldPosBottom.z,
      float(1.0)
    );

    // Get camera matrices from uniforms (manually updated each frame)
    const viewMatrix = uniforms.uViewMatrix;
    const projMatrix = uniforms.uProjectionMatrix;
    const viewProjMatrix = projMatrix.mul(viewMatrix);

    // Transform bottom position to clip space
    const clipPosBottom = viewProjMatrix.mul(
      vec4(worldPosBottom.x, worldPosBottom.y, worldPosBottom.z, float(1.0))
    );
    
    // [Fix] Check if point is in front of camera (w > 0) before NDC division
    // Points behind camera have negative w, which causes incorrect NDC values
    const isBottomInFront = clipPosBottom.w.greaterThan(float(0.0));
    const ndcBottom = clipPosBottom.xyz.div(clipPosBottom.w);

    // Transform top position to clip space
    const clipPosTop = viewProjMatrix.mul(worldPosTop);
    
    // [Fix] Check if point is in front of camera (w > 0)
    const isTopInFront = clipPosTop.w.greaterThan(float(0.0));
    const ndcTop = clipPosTop.xyz.div(clipPosTop.w);

    // Check if either bottom or top position is within frustum bounds
    // Use a margin to account for blade width
    const margin = float(0.1); // Margin for blade width

    // Check if bottom position is in frustum
    // Must satisfy: "in front of camera" AND "within frustum bounds"
    const bottomInFrustum = isBottomInFront
      .and(ndcBottom.x.greaterThan(float(-1.0).sub(margin)))
      .and(ndcBottom.x.lessThan(float(1.0).add(margin)))
      .and(ndcBottom.y.greaterThan(float(-1.0).sub(margin)))
      .and(ndcBottom.y.lessThan(float(1.0).add(margin)))
      // WebGPU uses [0, 1] depth range instead of [-1, 1]
      .and(ndcBottom.z.greaterThan(float(0.0).sub(margin)))
      .and(ndcBottom.z.lessThan(float(1.0).add(margin)));

    // Check if top position is in frustum
    // Must satisfy: "in front of camera" AND "within frustum bounds"
    const topInFrustum = isTopInFront
      .and(ndcTop.x.greaterThan(float(-1.0).sub(margin)))
      .and(ndcTop.x.lessThan(float(1.0).add(margin)))
      .and(ndcTop.y.greaterThan(float(-1.0).sub(margin)))
      .and(ndcTop.y.lessThan(float(1.0).add(margin)))
      // WebGPU uses [0, 1] depth range instead of [-1, 1]
      .and(ndcTop.z.greaterThan(float(0.0).sub(margin)))
      .and(ndcTop.z.lessThan(float(1.0).add(margin)));


    // circle
    const isInCircle = length(worldPos.sub(uniforms.uGroupOffset)).lessThan(uniforms.uGrassAreaSize.mul(0.5));

    // Blade is in frustum if either bottom or top is visible
    const inFrustum = bottomInFrustum.or(topInFrustum).and(isInCircle);
    return inFrustum;
  });

  const computeFn = Fn(() => {
    const bladeRandX = uniforms.uBladeRandomness.x;
    const bladeRandY = uniforms.uBladeRandomness.y;
    const bladeRandZ = uniforms.uBladeRandomness.z;

    // Calculate Voronoi clump information with attribute blending (F1 and F2)
    const getClumpInfo = (worldXZ: any) => {
      const cell = worldXZ.div(uniforms.uClumpSize);
      const i_base = floor(cell);
      const f_base = fract(cell);
  
      const minD2_1 = float(1e9).toVar();
      const minD2_2 = float(1e9).toVar();
  
      const bestCellId = vec2(0.0).toVar();
      const secondBestCellId = vec2(0.0).toVar();
      const bestDiff = vec2(0.0).toVar();
  
      const offsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [0, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1]
      ];

      offsets.forEach(([x, y]) => {
        const neighbor = vec2(float(x), float(y));
        const currentCellId = i_base.add(neighbor);

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
      const smoothness = uniforms.uClumpBlendSmoothness ?? float(0.2); // Blend region width (controllable)
      
      // centerFactor represents "how close to cell center": 0.0 = boundary, 1.0 = center
      const centerFactor = smoothstep(float(0.0), smoothness, d2.sub(d1));
  
      const toCenter = bestDiff.mul(uniforms.uClumpSize);
      
      return { toCenter, bestCellId, secondBestCellId, centerFactor };
    };

    // Generate per-clump parameters
    // Uses presence to add random type variation at clump edges
    const getClumpParams = (cellId: any) => {
      const c1 = hash21(cellId.mul(11.0));
      const c2 = hash21(cellId.mul(23.0));

      const clumpBaseHeight = mix(
        uniforms.uBladeHeightMin,
        uniforms.uBladeHeightMax,
        c1.x
      );
      const clumpBaseWidth = mix(
        uniforms.uBladeWidthMin,
        uniforms.uBladeWidthMax,
        c1.y
      );
      const clumpBaseBend = mix(
        uniforms.uBendAmountMin,
        uniforms.uBendAmountMax,
        c2.x
      );

      const type = c2.y;

      return {
        height: clumpBaseHeight,
        width: clumpBaseWidth,
        bend: clumpBaseBend,
        type: type,
      };
    };

    // Generate per-blade parameters based on clump params
    const getBladeParams = (seed: any, clumpParams: any) => {
      const h1 = hash21(seed.mul(13.0));
      const h2 = hash21(seed.mul(29.0));

      const height = clumpParams.height.mul(
        mix(oneMinus(bladeRandX), float(1.0).add(bladeRandX), h1.x)
      );
      const width = clumpParams.width.mul(
        mix(oneMinus(bladeRandY), float(1.0).add(bladeRandY), h1.y)
      );
      const bend = clumpParams.bend.mul(
        mix(oneMinus(bladeRandZ), float(1.0).add(bladeRandZ), h2.x)
      );
      const type = clumpParams.type;

      return { height, width, bend, type };
    };

    // Calculate base angle with clump and per-blade variations
    const calculateBaseAngle = (
      toCenter: any,
      _worldXZ: any,
      cellId: any,
      perBladeHash01: any,
      centerFactor: any
    ) => {
      const clumpAngle = atan(toCenter.y, toCenter.x).mul(uniforms.uCenterYaw).mul(centerFactor);
      const randomOffset = perBladeHash01.sub(0.5).mul(uniforms.uBladeYaw);
      const clumpHash = hash11(dot(cellId, vec2(97.7, 3.1)));
      const clumpYaw = clumpHash.sub(0.5).mul(uniforms.uClumpYaw).mul(centerFactor);
      return clumpAngle.add(randomOffset).add(clumpYaw);
    };


    // Calculate jittered instance position from instanceIndex
    const calculateJitteredPosition = Fn(([idx]: [any]) => {
      // Calculate grid cell (x, z) from instanceIndex (local space)
      const bladesPerAxis = uniforms.uBladesPerAxis;
      const grassAreaSize = uniforms.uGrassAreaSize;
      const gridX = floor(float(idx).div(bladesPerAxis));
      const gridZ = float(idx).sub(gridX.mul(bladesPerAxis));

      // Calculate base position from grid cell (without jitter, in local space)
      // fx = x / bladesPerAxis - 0.5, fz = z / bladesPerAxis - 0.5
      // px = fx * grassAreaSize, pz = fz * grassAreaSize
      const fx = gridX.div(bladesPerAxis).sub(0.5);
      const fz = gridZ.div(bladesPerAxis).sub(0.5);
      const px = fx.mul(grassAreaSize);
      const pz = fz.mul(grassAreaSize);
      const instancePosRaw = vec3(px, float(0.0), pz);

      // Calculate world position by adding group offset (for seed calculation consistency)
      // Using uGroupOffset instead of uModelMatrix ensures seed is based on world position only
      // This way, any blade at the same world grid cell will have the same seed, regardless of which instance it is
      const worldPosRaw = instancePosRaw.add(uniforms.uGroupOffset);

      // Calculate world grid cell using grid cell size (for infinite grass)
      const worldGridX = floor(worldPosRaw.x.div(uniforms.uGridCellSize));
      const worldGridZ = floor(worldPosRaw.z.div(uniforms.uGridCellSize));

      // Calculate jitter using seededRandom function with WORLD grid cell (for consistency)
      // Seed is based on world grid cell, so blades at same world position have same jitter
      const seedBase = worldGridX
        .mul(7919.0)
        .add(worldGridZ.mul(7919.0))
        .mul(0.0001);
      const jitterX = seededRandom(seedBase).sub(0.5).mul(0);
      const jitterZ = seededRandom(seedBase.add(1.0)).sub(0.5).mul(0);

      // Apply jitter to instance position (local space)
      const instancePosLocal = vec3(
        instancePosRaw.x.add(jitterX),
        instancePosRaw.y,
        instancePosRaw.z.add(jitterZ)
      );

      // Transform to world space by adding group offset
      // Since group only has translation (no rotation/scale), simple addition is sufficient
      // Return world position directly
      return instancePosLocal.add(uniforms.uGroupOffset);
    });

    // Main compute logic
    const data = grassData.element(instanceIndex);

    // Calculate jittered instance position (world space)
    const worldPos = calculateJitteredPosition(instanceIndex);

    // Write world position to buffer for material shader to use directly
    positions.element(instanceIndex).assign(worldPos);

    // Get worldXZ position (x and z components) - now in world space for consistent clumping/wind
    const worldXZ = vec2(worldPos.x, worldPos.z);

    // Calculate Voronoi clump information with attribute blending
    const { toCenter, bestCellId, secondBestCellId, centerFactor } = getClumpInfo(worldXZ);

    // Calculate blendFactor from centerFactor:
    // At boundary (centerFactor=0) -> 0.5 (50% each cell)
    // At center (centerFactor=1) -> 1.0 (100% best cell)
    const blendFactor = mix(float(0.5), float(1.0), centerFactor);

    // Calculate two sets of clump parameters for blending
    const params1 = getClumpParams(bestCellId);
    const params2 = getClumpParams(secondBestCellId);

    const calculateEdgeFade = (worldPos: any) => {
      const worldPosRaw = worldPos.sub(uniforms.uGroupOffset);
      const diffX = worldPosRaw.x.div(uniforms.uGridCellSize);
      const diffZ = worldPosRaw.z.div(uniforms.uGridCellSize);
      const totalGridCells = uniforms.uGrassAreaSize.div(uniforms.uGridCellSize);
      const halfGridCells = totalGridCells.mul(0.5);
      const edgeGrids = float(10.0); // Number of grid cells to fade over
      
      const fadeStart = halfGridCells.sub(edgeGrids);
      const fadeEnd = halfGridCells;
      const fadeX = float(1.0).sub(smoothstep(fadeStart, fadeEnd, abs(diffX)));
      const fadeZ = float(1.0).sub(smoothstep(fadeStart, fadeEnd, abs(diffZ)));
      return fadeX.mul(fadeZ);
    };
    
    const fade = calculateEdgeFade(worldPos);

    const clumpParams = {
      height: mix(params2.height, params1.height, blendFactor).mul(fade),
      width: mix(params2.width, params1.width, blendFactor).mul(fade),
      bend: mix(params2.bend, params1.bend, blendFactor),
      type: params1.type
    };

    const bladeParams = getBladeParams(worldXZ, clumpParams);

    // Calculate presence using blendFactor (1.0 at center, 0.5 at boundary)
    // This creates smooth transitions without gaps
    const presence = blendFactor;
    
    const perBladeHash01 = hash11(dot(worldXZ, vec2(37.0, 17.0)));
    const clumpSeed01 = hash11(dot(bestCellId, vec2(47.3, 61.7)));

    // Calculate blade facing angle (use bestCellId for consistency)
    const baseAngle = calculateBaseAngle(
      toCenter,
      worldXZ,
      bestCellId,
      perBladeHash01,
      centerFactor
    );

    // Apply wind effects
    const windStrength = calculateWindStrength(worldXZ, {
      uWindDir: uniforms.uWindDir,
      uWindScale: uniforms.uWindScale,
      uTime: uniforms.uTime,
      uWindSpeed: uniforms.uWindSpeed,
      uWindStrength: uniforms.uWindStrength,
    });
    const facingAngle01 = applyWindFacingAndNormalize(baseAngle, windStrength, {
      uWindDir: uniforms.uWindDir,
      uWindFacing: uniforms.uWindFacing,
    });

    // Write all parameters back to data structure
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

    // Perform culling to check visibility (pass world position directly)
    const isVisible = performCulling(worldPos);

    // Calculate distance to camera for LOD decision (pass world position directly)
    const distToCamera = calculateDistance(worldPos);

    If(isVisible, () => {
      buildLODRouting(distToCamera, instanceIndex);
    });
  });

  return {
    computeFn,
  };
}

/**
 * Creates a lightweight compute shader to reset the indirect draw buffers
 * This should be executed before the main culling compute shader each frame
 */
export function createResetDrawBufferCompute(lodConfigs: LODBufferConfig[]) {
  const resetFn = Fn(() => {
    // Reset all LOD buffers
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
