#ifndef UTILITY_GLSL
#define UTILITY_GLSL

float remap(float value, vec2 minmaxI, vec2 minmaxO) {
    return minmaxO.x + (value - minmaxI.x) * (minmaxO.y - minmaxO.x) / (minmaxI.y - minmaxI.x);
}

vec2 rotate2D(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat2 m = mat2(c, s, -s, c);
    return m * p;
}

vec3 rotate3D(vec3 p, vec3 axis, float angle) {
    return mix(dot(axis, p) * axis, p, cos(angle)) + cross(axis, p) * sin(angle);
}

mat2 rotate2DMat(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

float random2D(vec2 value) {
    return fract(sin(dot(value.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float remap(float value, float originMin, float originMax, float destinationMin, float destinationMax) {
    return destinationMin + (value - originMin) * (destinationMax - destinationMin) / (originMax - originMin);
}

float smoothEdge(vec2 uv, vec2 smoothness) {
    return smoothstep(0.0, smoothness.x, uv.x) * smoothstep(1.0, 1.0 - smoothness.x, uv.x) * smoothstep(0.0, smoothness.y, uv.y) * smoothstep(1.0, 1.0 - smoothness.y, uv.y);
}

float Contrast(float In, float Contrast) {
    float midpoint = pow(0.5, 2.2);
    return (In - midpoint) * Contrast + midpoint;
}

mat4 eulerAnglesToRotationMatrix(vec3 angles) {
    float ch = cos(angles.y);
    float sh = sin(angles.y); // heading
    float ca = cos(angles.z);
    float sa = sin(angles.z); // attitude
    float cb = cos(angles.x);
    float sb = sin(angles.x); // bank
    // RyRxRz (Heading Bank Attitude)
    return mat4(ch * ca + sh * sb * sa, -ch * sa + sh * sb * ca, sh * cb, 0, cb * sa, cb * ca, -sb, 0, -sh * ca + ch * sb * sa, sh * sa + ch * sb * ca, ch * cb, 0, 0, 0, 0, 1);
}


float backout(float progress, float swing) {
    float p = progress - 1.0;
    return (p * p * ((swing + 1.0) * p + swing) + 1.0);
}

#endif
