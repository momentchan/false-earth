// Note: For now, include the GLSL as strings. In a build system, these could be imported as raw text.
// You can replace these with actual file imports if your bundler supports ?raw imports

import * as THREE from 'three';

const fractalGLSL = `
// Placeholder - include actual fractal.glsl content here
// This should be replaced with the actual GLSL content from cginc/noise/fractal.glsl
vec3 simplex3d_fractal(vec3 p) {
    // Simplified fractal implementation - replace with actual fractal.glsl
    return vec3(0.5);
}
`;

const utilityGLSL = `
// Utility functions - replace with actual utility.glsl content
float remap(float value, vec2 minmaxI, vec2 minmaxO) {
    return minmaxO.x + (value - minmaxI.x) * (minmaxO.y - minmaxO.x) / (minmaxI.y - minmaxI.x);
}

float Contrast(float In, float Contrast) {
    float midpoint = pow(0.5, 2.2);
    return (In - midpoint) * Contrast + midpoint;
}
`;

interface FractalShaderUniforms {
    tDiffuse: { value: THREE.Texture | null };
    uTime: { value: number };
    uSpeed: { value: number };
    uAspect: { value: number };
}

/**
 * FractalShader - A shader preset for fractal noise rendering
 * 
 * Features:
 * - 3D simplex noise with fractal properties
 * - Time-based animation
 * - Aspect ratio correction
 * - Configurable speed and contrast
 * 
 * @example
 * ```typescript
 * import { fractalShader } from '@/packages/r3f-gist/shaders';
 * 
 * const material = new THREE.ShaderMaterial(fractalShader);
 * material.uniforms.uSpeed.value = 0.1;
 * ```
 */
export const fractalShader = {
    name: 'FractalShader',

    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uSpeed: { value: 0 },
        uAspect: { value: 1 }
    } as FractalShaderUniforms,

    vertexShader: /* glsl */`
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uAspect;
        varying vec2 vUv;

        ${fractalGLSL}
        ${utilityGLSL}
        
        /**
         * Generate fractal noise value at given UV and time
         * @param uv - UV coordinates
         * @param time - Current time for animation
         * @return Normalized fractal value [0, 1]
         */
        float getFractal(vec2 uv, float time) {
            vec3 p = vec3(uv, time);
        
            float value;
            // Note: Replace with actual fractal function when GLSL includes are properly imported
            // value = fbm4(p.xy, p.z); // Use fbm4 from fractal.glsl
            value = sin(p.x + p.y + p.z); // Temporary placeholder
            value = Contrast(value, 5.0);
        
            value = remap(value, vec2(-1.0, 1.0), vec2(0.0, 1.0));
            value = clamp(value, 0.0, 1.0);
            return value;
        }

        void main() {
            // Apply aspect ratio correction and generate fractal
            vec2 aspectUv = vUv * 1.5 * vec2(uAspect, 1.0);
            float fractalValue = getFractal(aspectUv, uTime * uSpeed);
            
            vec4 col = vec4(vec3(fractalValue), 1.0);
            gl_FragColor = col;
        }
    `
};

export default fractalShader;
