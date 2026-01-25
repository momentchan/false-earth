import { uniform } from 'three/tsl';

/**
 * Wind uniforms interface
 * Shared across grass, rose, and wind components
 */
export interface WindUniforms {
  uWindDir: ReturnType<typeof uniform>;
  uWindScale: ReturnType<typeof uniform>;
  uWindSpeed: ReturnType<typeof uniform>;
  uWindStrength: ReturnType<typeof uniform>;
  uWindFacing: ReturnType<typeof uniform>;
  uTime: ReturnType<typeof uniform>;
}
