import {
    atomicAdd, atomicStore, storage, uint, instanceIndex, instancedArray, hash, If, Fn, float, fract, mix, vec3, sin, cos, sqrt, vec4,
    abs,
    distance,
} from "three/tsl";
import { uDeltaTime } from "../../../core/shaders/uniforms";
    
export function createUpdateCompute(
    lodBuffers: Array<{
        drawStorage: ReturnType<typeof storage>,
        indices: ReturnType<typeof instancedArray>,
        minDistance: number,
        maxDistance: number
    }>,
    vatData: ReturnType<typeof instancedArray>,
    count: number,
    uniforms: Record<string, any>,
) {
    // Build LOD routing chain
    const createLODRoutingChain = (configs: typeof lodBuffers) => {
        return (distToCamera: any, instanceIdx: any) => {
            if (configs.length === 0) return;

            // Single LOD case
            if (configs.length === 1) {
                const config = configs[0];
                const lodIndex = atomicAdd(
                    config.drawStorage.get("instanceCount"),
                    uint(1)
                );
                config.indices.element(lodIndex).assign(uint(instanceIdx));
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

                const inRange = distToCamera.greaterThanEqual(minDist).and(
                    isLast || config.maxDistance === Infinity
                        ? distToCamera.lessThanEqual(maxDist)
                        : distToCamera.lessThan(maxDist)
                );

                const lodBlock = () => {
                    const lodIndex = atomicAdd(
                        config.drawStorage.get("instanceCount"),
                        uint(1)
                    );
                    config.indices.element(lodIndex).assign(uint(instanceIdx));
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

    const buildLODRouting = createLODRoutingChain(lodBuffers);

    const updateFn = Fn(() => {
        const data = vatData.element(instanceIndex)

        // Simple animation logic: if active, update frame
        If(data.get("isActive").greaterThan(0), () => {
            const seed = data.get("seed")
            const pos = data.get("position")

            // Use seed to interpolate between min/max for each phase duration
            const delayDuration = mix(uniforms.uDelayMin, uniforms.uDelayMax, seed)
            const growDuration = mix(uniforms.uGrowMin, uniforms.uGrowMax, seed)
            const keepDuration = mix(uniforms.uKeepMin, uniforms.uKeepMax, seed)
            const dieDuration = mix(uniforms.uDieMin, uniforms.uDieMax, seed)

            // Calculate total lifetime and phase boundaries
            const lifetime = delayDuration.add(growDuration).add(keepDuration).add(dieDuration)
            const p1 = delayDuration.div(lifetime)
            const p2 = delayDuration.add(growDuration).div(lifetime)
            const p3 = delayDuration.add(growDuration).add(keepDuration).div(lifetime)

            const currentAge = data.get("age");
            const dt = uDeltaTime;
            currentAge.addAssign(dt.mul(1));

            const progress = currentAge.div(lifetime)

            If(progress.greaterThan(1.0), () => {
                data.get("isActive").assign(0.0)
                data.get("progress").assign(0.0)
                data.get("frame").assign(0.0)
                data.get("age").assign(0.0)
            }).Else(() => {
                const currentFrame = float(0.0).toVar();

                If(progress.lessThan(p1), () => {
                    currentFrame.assign(0.0)
                })
                    .ElseIf(progress.lessThan(p2), () => {
                        const stateProgress = progress.sub(p1).div(p2.sub(p1))
                        const easedProgress = (stateProgress)
                        currentFrame.assign(easedProgress)
                    })
                    .ElseIf(progress.lessThan(p3), () => {
                        currentFrame.assign(1.0)
                    })
                    .Else(() => {
                        const stateProgress = progress.sub(p3).div(float(1.0).sub(p3))
                        const easedProgress = (stateProgress)
                        currentFrame.assign(float(1.0).sub(easedProgress))
                    })

                data.get("progress").assign(progress.clamp(0.0, 1.0))
                data.get("frame").assign(currentFrame)

                // Frustum culling
                const clipPos = uniforms.uViewProjectionMatrix.mul(vec4(pos, 1.0))
                const cullRadius = float(3)
                const w = clipPos.w;

                const isInFront = w.greaterThan(cullRadius.negate());
                const limit = w.add(cullRadius);

                const inFrustum = isInFront
                    .and(abs(clipPos.x).lessThanEqual(limit))
                    .and(abs(clipPos.y).lessThanEqual(limit))
                    .and(abs(clipPos.z).lessThanEqual(limit));

                const distToCamera = distance(pos, uniforms.uCameraPosition);
                const inCircle = distToCamera.lessThan(5);

                If(inFrustum.or(inCircle), () => {
                    buildLODRouting(distToCamera, instanceIndex);
                })
            })
        })
    })
    return updateFn().compute(count)
}

export function createResetCountCompute(drawStorage: ReturnType<typeof storage>, indexCount: number) {
    return Fn(() => {
        drawStorage.get("vertexCount").assign(uint(indexCount))
        atomicStore(drawStorage.get("instanceCount"), uint(0))
    })().compute(1)
}

export const createResetInstanceCompute = (vatData: ReturnType<typeof instancedArray>, count: number) => {
    return Fn(() => {
        const data = vatData.element(instanceIndex)
        data.get("isActive").assign(0.0)
        data.get("progress").assign(0.0)
        data.get("frame").assign(0.0)
        data.get("age").assign(0.0)
    })().compute(count)
}

export function createSpawnCompute(
    vatData: ReturnType<typeof instancedArray>,
    spawnStorage: ReturnType<typeof storage>,
    uniforms: { uSpawnPos: any, uSpawnCount: any, uSpawnRadius: any },
    batchSize: number,
    maxCount: number
) {
    const spawnFn = Fn(() => {
        If(instanceIndex.lessThan(uniforms.uSpawnCount), () => {

            const headIndex = atomicAdd(spawnStorage.get("index"), uint(1)).mod(uint(maxCount));

            const instance = vatData.element(headIndex);

            const seed = hash(uint(instanceIndex));
            const seed2 = hash(uint(instanceIndex).add(uint(1)));
            const seed3 = hash(uint(instanceIndex).add(uint(2)));

            const angle = seed.mul(6.28318);
            const r = sqrt(seed2).mul(uniforms.uSpawnRadius);

            const offsetX = cos(angle).mul(r);
            const offsetZ = sin(angle).mul(r);

            const randomPos = vec3(
                uniforms.uSpawnPos.x.add(offsetX),
                uniforms.uSpawnPos.y,
                uniforms.uSpawnPos.z.add(offsetZ)
            );

            const timeOffset = seed3.mul(1.0);

            instance.get('position').assign(randomPos);
            instance.get('isActive').assign(1.0);
            instance.get('frame').assign(0.0);
            instance.get('age').assign(timeOffset.negate());
            instance.get('seed').assign(fract(seed.add(seed2).add(seed3)));
            instance.get('progress').assign(0.0);
        })
    });

    return spawnFn().compute(batchSize);
}

export function createVisibleIndicesBuffer(count: number) {
    return instancedArray(new Uint32Array(count), 'uint');
}