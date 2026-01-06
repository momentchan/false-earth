/**
 * Standard screen-space vertex shader
 * 
 * A basic vertex shader for full-screen effects and post-processing.
 * Transforms vertices and passes UV coordinates to the fragment shader.
 * 
 * @example
 * ```typescript
 * import { screenVertex } from '@/packages/r3f-gist/shaders';
 * 
 * const material = new THREE.ShaderMaterial({
 *   vertexShader: screenVertex,
 *   fragmentShader: myFragmentShader
 * });
 * ```
 */
export const screenVertex = /* glsl */`
    varying vec2 vUv;

    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
    }
`;

export default screenVertex;


