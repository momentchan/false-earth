#include "simplexNoise.glsl"

float fbm4(vec2 p, float t)
{
	float f;
	f = 0.50000 * simplexNoise3d(vec3(p, t)); p = p * 2.01;
	f += 0.25000 * simplexNoise3d(vec3(p, t)); p = p * 2.02; //from iq
	f += 0.12500 * simplexNoise3d(vec3(p, t)); p = p * 2.03;
	f += 0.06250 * simplexNoise3d(vec3(p, t));
	return f * (1.0 / 0.9375) * 0.5 + 0.5;
}

float fbm3(vec2 p, float t)
{
	float f;
	f = 0.50000 * simplexNoise3d(vec3(p, t)); p = p * 2.01;
	f += 0.25000 * simplexNoise3d(vec3(p, t)); p = p * 2.02; //from iq
	f += 0.12500 * simplexNoise3d(vec3(p, t));
	return f * (1.0 / 0.875) * 0.5 + 0.5;
}

float fbm2(vec2 p, float t)
{
	float f;
	f = 0.50000 * simplexNoise3d(vec3(p, t)); p = p * 2.01;
	f += 0.25000 * simplexNoise3d(vec3(p, t));
	return f * (1.0 / 0.75) * 0.5 + 0.5;
}