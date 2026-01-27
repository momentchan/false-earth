import { atomicAdd, atomicStore, storage, uint, instanceIndex, instancedArray, hash, If, time, Fn, float, fract, mix, step, vec3, sin, cos, sqrt, floor, vec4,
    cameraViewMatrix,
    cameraProjectionMatrix,
    abs
 } from "three/tsl";

/**
 * Create update compute shader
 * Updates animation frame based on lifecycle progress (Delay, Grow, Keep, Die)
 * Uses seed to determine per-instance phase durations
 */
export function createUpdateCompute(
    drawStorage: ReturnType<typeof storage>,
    indices: ReturnType<typeof instancedArray>,
    vatData: ReturnType<typeof instancedArray>,
    count: number,
    uniforms: Record<string, any>,
) {
    const updateFn = Fn(() => {
        /**
         * Easing function: easeInOutCubic
         * Provides smooth acceleration and deceleration
         */
        const easeInOutCubic = (t: any) => {
            const clampedT = t.clamp(0.0, 1.0);
            const val1 = clampedT.mul(clampedT).mul(clampedT).mul(4.0);
            const p = clampedT.sub(1.0);
            const val2 = p.mul(p).mul(p).mul(4.0).add(1.0);
            const isSecondHalf = step(0.5, clampedT);
            return mix(val1, val2, isSecondHalf);
        };

        const data = vatData.element(instanceIndex)

        // Simple animation logic: if active, update frame
        If(data.get("isActive").greaterThan(0), () => {
            const seed = data.get("seed")
            const age = time.sub(data.get("startTime"))

            // Use seed to interpolate between min/max for each phase duration
            const delayDuration = mix(uniforms.uDelayMin, uniforms.uDelayMax, seed)
            const growDuration = mix(uniforms.uGrowMin, uniforms.uGrowMax, seed)
            const keepDuration = mix(uniforms.uKeepMin, uniforms.uKeepMax, seed)
            const dieDuration = mix(uniforms.uDieMin, uniforms.uDieMax, seed)

            // Calculate total lifetime and phase boundaries
            const lifetime = delayDuration.add(growDuration).add(keepDuration).add(dieDuration)
            const p1 = delayDuration.div(lifetime) // Delay phase boundary
            const p2 = delayDuration.add(growDuration).div(lifetime) // Grow phase boundary
            const p3 = delayDuration.add(growDuration).add(keepDuration).div(lifetime) // Keep phase boundary
            // p3 ~ 1.0: Die phase

            const progress = age.div(lifetime)

            If(progress.greaterThan(1.0), () => {
                data.get("isActive").assign(0.0)
                data.get("progress").assign(0.0)
                data.get("frame").assign(0.0)
            }).Else(() => {
                const currentFrame = float(0.0).toVar();

                // Phase 0: Delay (0.0 ~ p1) - frame stays at 0
                If(progress.lessThan(p1), () => {
                    currentFrame.assign(0.0)
                })
                    // Phase 1: Grow (p1 ~ p2) - frame grows from 0 to 1 with easing
                    .ElseIf(progress.lessThan(p2), () => {
                        const stateProgress = progress.sub(p1).div(p2.sub(p1))
                        const easedProgress = (stateProgress)
                        currentFrame.assign(easedProgress)
                    })
                    // Phase 2: Keep (p2 ~ p3) - frame stays at 1
                    .ElseIf(progress.lessThan(p3), () => {
                        currentFrame.assign(1.0)
                    })
                    // Phase 3: Die (p3 ~ 1.0) - frame decays from 1 to 0 with easing
                    .Else(() => {
                        const stateProgress = progress.sub(p3).div(float(1.0).sub(p3))
                        const easedProgress = (stateProgress)
                        currentFrame.assign(float(1.0).sub(easedProgress))
                    })

                data.get("progress").assign(progress.clamp(0.0, 1.0))
                data.get("frame").assign(currentFrame) // Animate
                // Add to draw queue


                const pos = data.get("position")
                const clipPos = uniforms.uViewProjectionMatrix.mul(vec4(pos, 1.0))

                const cullRadius = float(3)
                const w = clipPos.w;
                const limit = w.add(cullRadius);

                const inFrustum = 
                    abs(clipPos.x).lessThanEqual(limit)
                    .and(abs(clipPos.y).lessThanEqual(limit))
                    .and(clipPos.z.greaterThanEqual(cullRadius.negate())) // Near plane (allow slightly behind)
                    .and(clipPos.z.lessThanEqual(limit));



                If(inFrustum, () => {
                    const idx = atomicAdd(drawStorage.get("instanceCount"), uint(1))
                    indices.element(idx).assign(uint(instanceIndex))
                })
            })
        })
    })
    return updateFn().compute(count)
}

/**
 * Create reset compute shader
 * Resets the indirect draw buffer counters each frame
 */
export function createResetCompute(drawStorage: ReturnType<typeof storage>, indexCount: number) {
    return Fn(() => {
        drawStorage.get("vertexCount").assign(uint(indexCount))
        atomicStore(drawStorage.get("instanceCount"), uint(0))
    })().compute(1)
}

/**
 * Create spawn compute shader (Batch Version)
 * Capable of spawning multiple instances per frame
 * Parallelizes spawn operations using GPU threads
 */
export function createSpawnCompute(
    vatData: ReturnType<typeof instancedArray>,
    spawnStorage: ReturnType<typeof storage>, // use to record the current index of the rose
    uniforms: { uSpawnPos: any, uSpawnCount: any, uSpawnRadius: any },
    batchSize: number,
    maxCount: number
) {
    const spawnFn = Fn(() => {
        // Only threads within the requested spawn count will execute
        If(instanceIndex.lessThan(uniforms.uSpawnCount), () => {

            const headIndex = atomicAdd(spawnStorage.get("index"), uint(1)).mod(uint(maxCount));

            const instance = vatData.element(headIndex);

            // Generate seeds using hash function (more efficient than fract + multiplication)
            // hash function provides better distribution and performance
            const seed = hash(uint(instanceIndex)); // seed: for angle (Angle)
            const seed2 = hash(uint(instanceIndex).add(uint(1))); // seed2: for radius (Radius)
            const seed3 = hash(uint(instanceIndex).add(uint(2))); // seed3: for time offset

            const angle = seed.mul(6.28318); // PI * 2
            const r = sqrt(seed2).mul(uniforms.uSpawnRadius);

            const offsetX = cos(angle).mul(r);
            const offsetZ = sin(angle).mul(r);

            const randomPos = vec3(
                uniforms.uSpawnPos.x.add(offsetX),
                uniforms.uSpawnPos.y,
                uniforms.uSpawnPos.z.add(offsetZ)
            );

            const timeOffset = seed3.mul(1.0); // Use seed3 for time offset variation

            instance.get('position').assign(randomPos);
            instance.get('isActive').assign(1.0);
            instance.get('frame').assign(0.0);
            instance.get('startTime').assign(time.add(timeOffset));
            instance.get('seed').assign(fract(seed.add(seed2).add(seed3)));
            instance.get('progress').assign(0.0);
        })
    });

    // If uSpawnCount is 0, they all exit immediately (cheap).
    // If uSpawnCount is 10, the first 10 threads spawn flowers.
    return spawnFn().compute(batchSize);
}

/**
 * Create visible indices buffer
 * Buffer to store indices of visible instances for indirect drawing
 */
export function createVisibleIndicesBuffer(count: number) {
    return instancedArray(new Uint32Array(count), 'uint')
}
