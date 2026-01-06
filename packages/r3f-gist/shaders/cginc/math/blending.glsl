/*  Photoshop Blend Modes - WebGL-safe (no #version) */
#ifndef PHOTOSHOP_MATH_WEBGL
#define PHOTOSHOP_MATH_WEBGL

/* --------- utilities --------- */
#ifndef saturate
#define saturate(x) clamp(x, 0.0, 1.0)
#endif

/* ---------- Luma ------------ */
float Luma(vec3 rgb) {
    return dot(rgb, vec3(0.2126729, 0.7151522, 0.0721750));
}

/* ---------- Blend helpers (bool mix) ------------ */
vec3 sel(vec3 a, vec3 b, bvec3 cond) {
    return vec3(cond.x ? b.x : a.x, cond.y ? b.y : a.y, cond.z ? b.z : a.z);
}

/* ========== Multiply / Screen (最常用) ========== */
vec3 BlendMultiply(vec3 base, vec3 blend) {
    return base * blend;
}
vec3 BlendScreen(vec3 base, vec3 blend) {
    return 1.0 - (1.0 - base) * (1.0 - blend);
}

/* ========= Overlay (用邏輯 mix 重寫) ============ */
vec3 BlendOverlay(vec3 base, vec3 blend) {
    bvec3 lt = lessThan(base, vec3(0.5));
    vec3 m1 = 2.0 * base * blend;
    vec3 m2 = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    return sel(m1, m2, lt);
}

/* ========= SoftLight ================================= */
float SoftMask(float b, float s) {
    return (s < 0.5) ? (2.0 * b * s + b * b * (1.0 - 2.0 * s)) : (sqrt(b) * (2.0 * s - 1.0) + 2.0 * b * (1.0 - s));
}
vec3 BlendSoftLight(vec3 base, vec3 blend) {
    return vec3(SoftMask(base.r, blend.r), SoftMask(base.g, blend.g), SoftMask(base.b, blend.b));
}

/* ========== HardLight ================================= */
vec3 BlendHardLight(vec3 base, vec3 blend) {
    bvec3 lt = lessThan(blend, vec3(0.5));
    vec3 m1 = 2.0 * base * blend;
    vec3 m2 = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
    return sel(m1, m2, lt);
}

/* ========== Color Dodge / Burn  ====================== */
vec3 BlendColorDodge(vec3 base, vec3 blend) {
    bvec3 white = equal(blend, vec3(1.0));
    vec3 res = min(base / (1.0 - blend), vec3(1.0));
    return sel(res, blend, white);
}
vec3 BlendColorBurn(vec3 base, vec3 blend) {
    bvec3 zero = equal(blend, vec3(0.0));
    vec3 res = 1.0 - (1.0 - base) / blend;
    return sel(max(res, vec3(0.0)), blend, zero);
}

/* ----  Desaturate 1-liner (有 alpha 版) ------------- */
vec3 Desaturate(vec3 c, float f) {
    float g = dot(c, vec3(0.3, 0.59, 0.11));
    return mix(c, vec3(g), f);
}

/* ========== HSL/HSV Conversion Functions ========== */
vec3 RGBToHSL(vec3 color) {
    vec3 hsl; // init to 0 to avoid warnings ? (and reverse if + remove first part)

    float fmin = min(min(color.r, color.g), color.b); //Min. value of RGB
    float fmax = max(max(color.r, color.g), color.b); //Max. value of RGB
    float delta = fmax - fmin; //Delta RGB value

    hsl.z = (fmax + fmin) / 2.0; // Luminance
    hsl.y = hsl.z < 0.5 ? delta / (fmax + fmin) : delta / (2.0 - fmax - fmin); // Saturation

    float deltaR = (((fmax - color.r) / 6.0) + (delta * 0.5)) / delta;
    float deltaG = (((fmax - color.g) / 6.0) + (delta * 0.5)) / delta;
    float deltaB = (((fmax - color.b) / 6.0) + (delta * 0.5)) / delta;
    bool c1 = color.r == fmax;
    bool c2 = color.g == fmax;
    bool c3 = color.b == fmax;

    hsl.x = (c1) ? deltaB - deltaG : 0.0;
    hsl.x = (!c1 && c2) ? 0.33333333 + deltaR - deltaB : hsl.x;
    hsl.x = (!c1 && !c2 && c3) ? 0.66666666 + deltaG - deltaR : hsl.x;

    hsl.x += hsl.x < 0.0 ? 1.0 : 0.0;
    hsl.x -= hsl.x > 1.0 ? 1.0 : 0.0;

    hsl.x = delta == 0.0 ? 0.0 : hsl.x;
    hsl.y = delta == 0.0 ? 0.0 : hsl.y;

    return hsl;
}

vec3 HSLToRGB(vec3 hsl) {
    vec3 rgb = vec3(hsl.z);

    if(hsl.y != 0.0) {
        float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
        float p = 2.0 * hsl.z - q;

        float h = hsl.x * 6.0;
        float tr = h - floor(h / 6.0) * 6.0;

        if(tr < 1.0) {
            rgb = vec3(q, p + (q - p) * tr, p);
        } else if(tr < 2.0) {
            rgb = vec3(p + (q - p) * (2.0 - tr), q, p);
        } else if(tr < 3.0) {
            rgb = vec3(p, q, p + (q - p) * (tr - 2.0));
        } else if(tr < 4.0) {
            rgb = vec3(p, p + (q - p) * (4.0 - tr), q);
        } else if(tr < 5.0) {
            rgb = vec3(p + (q - p) * (tr - 4.0), p, q);
        } else {
            rgb = vec3(q, p, p + (q - p) * (6.0 - tr));
        }
    }
    return rgb;
}

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/* ========== HSL/HSV Shift Functions ========== */
vec3 HSLShift(vec3 baseColor, vec3 shift) {
    vec3 hsl = RGBToHSL(baseColor);
    hsl = hsl + shift;
    hsl.yz = saturate(hsl.yz);
    return HSLToRGB(hsl);
}

vec3 HSLShift(vec3 baseColor, vec4 shift) {
    return mix(baseColor, HSLShift(baseColor, shift.rgb), shift.a);
}

vec3 HSVShift(vec3 baseColor, vec3 shift) {
    vec3 hsv = rgb2hsv(baseColor);
    hsv = hsv + shift;
    hsv.yz = saturate(hsv.yz);
    return hsv2rgb(hsv);
}

vec3 HSVShift(vec3 baseColor, vec4 shift) {
    return mix(baseColor, HSVShift(baseColor, shift.rgb), shift.a);
}

#endif   /* PHOTOSHOP_MATH_WEBGL */
