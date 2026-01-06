/**
 * r3f-gist Shader Library
 * 
 * A comprehensive collection of shader materials, presets, and utilities
 * for React Three Fiber applications.
 * 
 * @example
 * ```typescript
 * import { CustomShaderMaterial, fractalShader } from '@/packages/r3f-gist/shaders';
 * 
 * // Use React component
 * <CustomShaderMaterial fragmentShader={myShader} />
 * 
 * // Use shader preset
 * const material = new THREE.ShaderMaterial(fractalShader);
 * ```
 */

// Shader material classes and React components
export * from './materials';

// Shader presets and definitions  
export { fractalShader, default as defaultFractalShader } from './fractalShader';
export { screenVertex, default as defaultScreenVertex } from './screenVertex';

// Note: GLSL include files in ./cginc/ are kept as-is for direct GLSL usage
// These can be imported in bundlers that support raw text imports
