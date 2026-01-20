#include "../../../../packages/r3f-gist/shaders/cginc/math/index.glsl"

// Compute shader for calculating per-instance frame values
// Each pixel in the output texture represents one instance's frame value

uniform float uDeltaTime;
uniform float uVatSpeed;
uniform float uFrames;
uniform float uFps;
uniform float uFrameRatio; // -1 if not set, otherwise use this value
uniform sampler2D uInstanceSeeds; // Texture containing instance seeds (optional)
uniform float uHasInstanceSeeds; // 1.0 if seeds texture exists, 0.0 otherwise
uniform sampler2D uPreviousFrame; // Previous frame texture (ping-pong)
uniform float uInstanceCount; // Total number of instances (for texture sampling)

// Per-instance state durations texture (RGBA = state0, state1, state2, state3)
uniform sampler2D uStateDurations;

// Per-instance plane UVs texture (RG = u, v)
uniform sampler2D uPlaneUVs;

// Single intersection UV from InteractivePlane (vec2, -1, -1 if not set)
uniform vec2 uIntersectionUV;

varying vec2 vUv;

void main() {
    vec2 uv = vUv;
    float clampedU = clamp(uv.x, 0.0, 0.999999);
    float instanceIndex = floor(clampedU * uInstanceCount);

    float instanceSeed = 0.0;
    if(uHasInstanceSeeds > 0.5) {
        vec4 seedData = texture2D(uInstanceSeeds, uv);
        instanceSeed = seedData.r;
    } else {
        instanceSeed = fract(instanceIndex * 0.618033988749); // Golden ratio for better distribution
    }

    // Get previous frame data from ping-pong texture
    vec2 frameUV = uv;
    vec4 previousFrameData = texture2D(uPreviousFrame, frameUV);
    float previousAnimated = previousFrameData.g; // Green channel stores animated flag
    float previousCycleProgress = previousFrameData.a; // Alpha channel stores normalized cycle progress (0-1)

    float frame = 0.0;
    float animated = previousAnimated;
    float cycleProgress = previousCycleProgress;

    if(uFrameRatio >= 0.0) {
        // Use fixed frame ratio if specified (bypass animated logic)
        // frame = clamp(uFrameRatio, 0.0, 1.0);
        // animated = 0.0;
        // cycleProgress = 0.0;
    } else {
        // If animated is 1, accumulate cycle progress
        if(animated > 0.5) {
            // Sample per-instance state durations from texture
            vec4 durations = texture2D(uStateDurations, frameUV);
            float state0Duration = durations.r;
            float state1Duration = durations.g;
            float state2Duration = durations.b;
            float state3Duration = durations.a;

            // Calculate total cycle duration
            float totalCycleDuration = state0Duration + state1Duration + state2Duration + state3Duration;

            // Add delta time to cycle progress (normalized 0-1)
            float deltaProgress = (uDeltaTime * uVatSpeed) / totalCycleDuration;
            cycleProgress = cycleProgress + deltaProgress;

            // Check if cycle is complete
            if(cycleProgress >= 1.0) {
                // Cycle finished, set animated to 0 and reset
                animated = 0.0;
                frame = 0.0;
                cycleProgress = 0.0;
            } else {
                // Calculate frame based on normalized cycle progress
                float cycleTime = cycleProgress * totalCycleDuration;

                // Calculate state boundaries
                float state0End = state0Duration;
                float state1End = state0End + state1Duration;
                float state2End = state1End + state2Duration;
                float state3End = state2End + state3Duration;

                // State 0: Frame stays at 0
                if(cycleTime < state0End) {
                    frame = 0.0;
                }
                // State 1: Frame animates from 0 to 1
                else if(cycleTime < state1End) {
                    float stateTime = cycleTime - state0End;
                    float stateProgress = stateTime / state1Duration;
                    frame = clamp(easeOutCubic(stateProgress), 0.0, 1.0);
                }
                // State 2: Frame stays at 1
                else if(cycleTime < state2End) {
                    frame = 1.0;
                }
                // State 3: Frame animates from 1 to 0
                else {
                    float stateTime = cycleTime - state2End;
                    float stateProgress = stateTime / state3Duration;
                    frame = clamp(easeInOutCubic(1.0 - stateProgress), 0.0, 1.0);
                }
            }
        } else {
            // Not animated - check if intersection should trigger animation
            bool hasIntersection = uIntersectionUV.x >= 0.0 && uIntersectionUV.y >= 0.0;
            
            if(hasIntersection) {
                vec2 planeUV = texture2D(uPlaneUVs, frameUV).rg;
                planeUV.y = 1.0 - planeUV.y;
                float dist = distance(planeUV, uIntersectionUV);
                
                if(dist < 0.05) {
                    // Close enough to intersection UV - trigger animation
                    animated = 1.0;
                    cycleProgress = 0.0; // Reset to start animation from beginning
                    frame = 0.0;
                } else {
                    // Not close enough, keep frame at 0 and reset progress
                    frame = 0.0;
                    cycleProgress = 0.0;
                }
            } else {
                // No intersection, keep frame at 0 and reset progress
                frame = 0.0;
                cycleProgress = 0.0;
            }
        }
    }
    // Green channel: animated flag (0 or 1)
    // Blue channel: unused (0)
    // Alpha channel: normalized cycle progress (0-1)
    gl_FragColor = vec4(frame, animated, 0.0, cycleProgress);
}
