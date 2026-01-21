import {
  Fn,
  vec2,
  vec4,
  float,
  uniform,
  texture,
  uv,
  fract,
  sin,
  mul,
  clamp,
  floor,
  If,
  oneMinus,
  distance,
  step,
  greaterThanEqual,
  lessThan,
  lessThanEqual,
} from "three/tsl";

/**
 * TSL compute shader for calculating per-instance frame values
 * Each pixel in the output texture represents one instance's frame value
 * 
 * This replicates the logic from frameCompute.glsl using Three.js TSL
 * 
 * Note: This TSL shader is designed to work with NodeMaterial for FBO rendering.
 * To use it, create a MeshBasicNodeMaterial or similar and set the fragmentNode
 * to the result of createFrameComputeShader().
 * 
 * @example
 * ```typescript
 * import { createFrameComputeShader } from './frameCompute.tsl';
 * import { MeshBasicNodeMaterial } from 'three/webgpu';
 * 
 * const uniforms = {
 *   uDeltaTime: uniform(0),
 *   uVatSpeed: uniform(1),
 *   // ... other uniforms
 * };
 * 
 * const material = new MeshBasicNodeMaterial();
 * material.fragmentNode = createFrameComputeShader(uniforms)();
 * ```
 */

// Easing functions
const easeOutCubic = Fn(([t]: [any]) => {
  const p = t.sub(float(1.0));
  return p.mul(p).mul(p).add(float(1.0));
});

const easeInOutCubic = Fn(([t]: [any]) => {
  return If(t.lessThan(float(0.5)), () => {
    return float(4.0).mul(t).mul(t).mul(t);
  }).Else(() => {
    const p = t.sub(float(1.0));
    return float(4.0).mul(p).mul(p).mul(p).add(float(1.0));
  });
});

/**
 * Creates a TSL fragment shader function for frame computation
 * 
 * @param uniforms - Object containing all required uniforms
 * @returns A TSL function that computes frame values
 */
export function createFrameComputeShader(uniforms: {
  uDeltaTime: ReturnType<typeof uniform>;
  uVatSpeed: ReturnType<typeof uniform>;
  uFrames: ReturnType<typeof uniform>;
  uFps: ReturnType<typeof uniform>;
  uFrameRatio: ReturnType<typeof uniform>;
  uInstanceSeeds: ReturnType<typeof texture> | null;
  uHasInstanceSeeds: ReturnType<typeof uniform>;
  uPreviousFrame: ReturnType<typeof texture>;
  uInstanceCount: ReturnType<typeof uniform>;
  uStateDurations: ReturnType<typeof texture>;
  uPlaneUVs: ReturnType<typeof texture> | null;
  uIntersectionUV: ReturnType<typeof uniform>;
}) {
  return Fn(() => {
    const currentUV = uv();
    const clampedU = clamp(currentUV.x, float(0.0), float(0.999999));
    const instanceIndex = floor(clampedU.mul(uniforms.uInstanceCount));

    // Get instance seed
    const instanceSeed = If(uniforms.uHasInstanceSeeds.greaterThan(float(0.5)), () => {
      const seedData = texture(uniforms.uInstanceSeeds!, currentUV);
      return seedData.r;
    }).Else(() => {
      // Golden ratio for better distribution
      return fract(instanceIndex.mul(float(0.618033988749)));
    });

    // Get previous frame data from ping-pong texture
    const frameUV = currentUV;
    const previousFrameData = texture(uniforms.uPreviousFrame, frameUV);
    const previousAnimated = previousFrameData.g; // Green channel stores animated flag
    const previousCycleProgress = previousFrameData.a; // Alpha channel stores normalized cycle progress (0-1)

    // Initialize output values
    let frame = float(0.0).toVar();
    let animated = previousAnimated.toVar();
    let cycleProgress = previousCycleProgress.toVar();

    // Process frame calculation
    If(uniforms.uFrameRatio.greaterThanEqual(float(0.0)), () => {
      // Use fixed frame ratio if specified (bypass animated logic)
      // Currently commented out in original GLSL, so we do nothing here
    }).Else(() => {
      // If animated is 1, accumulate cycle progress
      If(animated.greaterThan(float(0.5)), () => {
        // Sample per-instance state durations from texture
        const durations = texture(uniforms.uStateDurations, frameUV);
        const state0Duration = durations.r;
        const state1Duration = durations.g;
        const state2Duration = durations.b;
        const state3Duration = durations.a;

        // Calculate total cycle duration
        const totalCycleDuration = state0Duration
          .add(state1Duration)
          .add(state2Duration)
          .add(state3Duration);

        // Add delta time to cycle progress (normalized 0-1)
        const deltaProgress = uniforms.uDeltaTime
          .mul(uniforms.uVatSpeed)
          .div(totalCycleDuration);
        cycleProgress.assign(cycleProgress.add(deltaProgress));

        // Check if cycle is complete
        If(cycleProgress.greaterThanEqual(float(1.0)), () => {
          // Cycle finished, set animated to 0 and reset
          animated.assign(float(0.0));
          frame.assign(float(0.0));
          cycleProgress.assign(float(0.0));
        }).Else(() => {
          // Calculate frame based on normalized cycle progress
          const cycleTime = cycleProgress.mul(totalCycleDuration);

          // Calculate state boundaries
          const state0End = state0Duration;
          const state1End = state0End.add(state1Duration);
          const state2End = state1End.add(state2Duration);
          const state3End = state2End.add(state3Duration);

          // State 0: Frame stays at 0
          If(cycleTime.lessThan(state0End), () => {
            frame.assign(float(0.0));
          })
            // State 1: Frame animates from 0 to 1
            .ElseIf(cycleTime.lessThan(state1End), () => {
              const stateTime = cycleTime.sub(state0End);
              const stateProgress = stateTime.div(state1Duration);
              frame.assign(clamp(easeOutCubic(stateProgress), float(0.0), float(1.0)));
            })
            // State 2: Frame stays at 1
            .ElseIf(cycleTime.lessThan(state2End), () => {
              frame.assign(float(1.0));
            })
            // State 3: Frame animates from 1 to 0
            .Else(() => {
              const stateTime = cycleTime.sub(state2End);
              const stateProgress = stateTime.div(state3Duration);
              frame.assign(clamp(easeInOutCubic(oneMinus(stateProgress)), float(0.0), float(1.0)));
            });
        });
      }).Else(() => {
        // Not animated - check if intersection should trigger animation
        const hasIntersection = uniforms.uIntersectionUV.x
          .greaterThanEqual(float(0.0))
          .and(uniforms.uIntersectionUV.y.greaterThanEqual(float(0.0)));

        If(hasIntersection, () => {
          const planeUVData = uniforms.uPlaneUVs
            ? texture(uniforms.uPlaneUVs, frameUV)
            : vec4(float(0.0), float(0.0), float(0.0), float(1.0));
          const planeUV = vec2(planeUVData.r, oneMinus(planeUVData.g));
          const dist = distance(planeUV, uniforms.uIntersectionUV);

          If(dist.lessThan(float(0.05)), () => {
            // Close enough to intersection UV - trigger animation
            animated.assign(float(1.0));
            cycleProgress.assign(float(0.0)); // Reset to start animation from beginning
            frame.assign(float(0.0));
          }).Else(() => {
            // Not close enough, keep frame at 0 and reset progress
            frame.assign(float(0.0));
            cycleProgress.assign(float(0.0));
          });
        }).Else(() => {
          // No intersection, keep frame at 0 and reset progress
          frame.assign(float(0.0));
          cycleProgress.assign(float(0.0));
        });
      });
    });

    // Output: R=frame, G=animated, B=unused(0), A=cycleProgress
    return vec4(frame, animated, float(0.0), cycleProgress);
  });
}
