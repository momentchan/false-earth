#include "../math/utility.glsl"

float random(vec2 st) {
    return fract(sin(dot(st.xy ,vec2(12.9898,78.233))) * 43758.5453123);
}

float grainNoise(vec2 uv, float frequency, vec2 range) {
    return remap(random(floor(uv * frequency)), vec2(0.0, 1.0), range);
}