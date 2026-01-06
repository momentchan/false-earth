uniform vec3 uFogColor;
uniform float uFogDensity;

float getFog(float density) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    return exp(-density * depth * depth);
}
