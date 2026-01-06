#ifndef EASING_GLSL
#define EASING_GLSL

// Easing functions mapped from easing.ts for shader usage
float easeLinear(float t) {
    return t;
}

float easeInQuad(float t) {
    return t * t;
}

float easeOutQuad(float t) {
    return t * (2.0 - t);
}

float easeInOutQuad(float t) {
    return t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
}

float easeInCubic(float t) {
    return t * t * t;
}

float easeOutCubic(float t) {
    float p = t - 1.0;
    return p * p * p + 1.0;
}

float easeInOutCubic(float t) {
    if (t < 0.5) {
        return 4.0 * t * t * t;
    }
    float p = t - 1.0;
    return 4.0 * p * p * p + 1.0;
}

float easeInQuart(float t) {
    float t2 = t * t;
    return t2 * t2;
}

float easeOutQuart(float t) {
    float p = t - 1.0;
    float p2 = p * p;
    return 1.0 - p2 * p2;
}

float easeInOutQuart(float t) {
    if (t < 0.5) {
        float t2 = t * t;
        return 8.0 * t2 * t2;
    }
    float p = t - 1.0;
    float p2 = p * p;
    return 1.0 - 8.0 * p2 * p2;
}

float easeInQuint(float t) {
    float t2 = t * t;
    return t2 * t2 * t;
}

float easeOutQuint(float t) {
    float p = t - 1.0;
    float p2 = p * p;
    return 1.0 + p2 * p2 * p;
}

float easeInOutQuint(float t) {
    if (t < 0.5) {
        float t2 = t * t;
        return 16.0 * t2 * t2 * t;
    }
    float p = t - 1.0;
    float p2 = p * p;
    return 1.0 + 16.0 * p2 * p2 * p;
}

#endif

