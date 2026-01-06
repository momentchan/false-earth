import * as THREE from 'three';

interface DofPointsMaterialUniforms {
    positions: { value: THREE.Texture | null };
    uTime: { value: number };
    uFocus: { value: number };
    uFov: { value: number };
    uBlur: { value: number };
    [uniform: string]: { value: any };
}

interface DofPointsMaterialOptions {
    positions?: THREE.Texture | null;
    uTime?: number;
    uFocus?: number;
    uFov?: number;
    uBlur?: number;
}

/**
 * DofPointsMaterial - Depth of Field Points Material
 * 
 * A specialized shader material for rendering points with depth-of-field blur effects.
 * Useful for particle systems that need realistic focus/blur based on distance.
 * 
 * Features:
 * - Distance-based blur calculation
 * - Focus point control
 * - Field of view integration
 * - Transparent circular points
 * 
 * @example
 * ```typescript
 * const material = new DofPointsMaterial({
 *   uFocus: 5.1,
 *   uFov: 50,
 *   uBlur: 30
 * });
 * ```
 */
export default class DofPointsMaterial extends THREE.ShaderMaterial {
    declare uniforms: DofPointsMaterialUniforms;

    constructor(options: DofPointsMaterialOptions = {}) {
        const {
            positions = null,
            uTime = 0,
            uFocus = 5.1,
            uFov = 50,
            uBlur = 30
        } = options;

        super({
            vertexShader: /* glsl */`
                uniform sampler2D positions;
                uniform float uTime;
                uniform float uFocus;
                uniform float uFov;
                uniform float uBlur;
                varying float vDistance;

                void main() {
                    vec3 pos = texture2D(positions, position.xy).xyz;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Calculate distance from focus point
                    vDistance = abs(uFocus - (-mvPosition.z));
                    
                    // Calculate point size based on distance and blur settings
                    gl_PointSize = step(1.0 - (1.0 / uFov), position.x) * vDistance * uBlur;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform float uOpacity;
                varying float vDistance;

                void main() {
                    // Create circular points
                    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                    if (dot(cxy, cxy) > 1.0) discard;

                    // Apply distance-based alpha for depth of field effect
                    float alpha = 1.04 - clamp(vDistance * 1.5, 0.0, 1.0);
                    gl_FragColor = vec4(vec3(1.0), alpha);
                }
            `,
            uniforms: {
                positions: { value: positions },
                uTime: { value: uTime },
                uFocus: { value: uFocus },
                uFov: { value: uFov },
                uBlur: { value: uBlur }
            },
            transparent: true,
            blending: THREE.NormalBlending,
            depthWrite: false
        });
    }

    /**
     * Update the positions texture
     */
    setPositions(texture: THREE.Texture | null): void {
        this.uniforms.positions.value = texture;
    }

    /**
     * Update the focus distance
     */
    setFocus(focus: number): void {
        this.uniforms.uFocus.value = focus;
    }

    /**
     * Update the field of view
     */
    setFov(fov: number): void {
        this.uniforms.uFov.value = fov;
    }

    /**
     * Update the blur intensity
     */
    setBlur(blur: number): void {
        this.uniforms.uBlur.value = blur;
    }

    /**
     * Update the time uniform (for animations)
     */
    setTime(time: number): void {
        this.uniforms.uTime.value = time;
    }
}