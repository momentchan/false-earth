import React, {
    forwardRef,
    useRef,
    useImperativeHandle,
    useEffect,
    ForwardedRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CustomShaderMaterialProps {
    /** Custom vertex shader (GLSL) */
    vertexShader?: string;
    /** Custom fragment shader (GLSL) */
    fragmentShader?: string;
    /** Shader uniforms object */
    uniforms?: Record<string, any>;
    /** Additional Three.js material properties */
    [key: string]: any;
}

interface ShaderMaterialRef extends THREE.ShaderMaterial {
    updateUniforms?: (uniforms: Record<string, any>) => void;
}

/* --------------------------------------------------------- */
/* Default shaders — basic UV coloring + time-based tint    */
/* --------------------------------------------------------- */
const DEFAULT_VS = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DEFAULT_FS = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec3 color = vec3(vUv, abs(sin(uTime)));
    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * CustomShaderMaterial - A React component wrapper for Three.js ShaderMaterial
 * 
 * Features:
 * - Automatic time uniform management
 * - Dynamic uniform updates
 * - TypeScript support
 * - Built-in performance optimizations
 * 
 * @example
 * ```tsx
 * <CustomShaderMaterial
 *   fragmentShader={myFragShader}
 *   uniforms={{ uColor: [1, 0, 0] }}
 *   transparent
 * />
 * ```
 */
export const CustomShaderMaterial = forwardRef<ShaderMaterialRef, CustomShaderMaterialProps>(
    (
        {
            vertexShader = DEFAULT_VS,
            fragmentShader = DEFAULT_FS,
            uniforms = {},
            ...props
        },
        ref: ForwardedRef<ShaderMaterialRef>
    ) => {
        /* 1. Build a uniform object that never changes its reference */
        const uniformRef = useRef<Record<string, { value: any }>>({
            uTime: { value: 0 },    // built-in time uniform
            // Convert initial uniforms to { value: xxx } form
            ...Object.fromEntries(
                Object.entries(uniforms).map(([key, val]) => [key, { value: val }])
            ),
        });

        /* 2. Expose the internal ShaderMaterial to parent via ref */
        const materialRef = useRef<THREE.ShaderMaterial>(null!);
        useImperativeHandle(ref, () => materialRef.current);

        /* 3. Increment uTime every frame */
        useFrame(({ clock }) => {
            if (uniformRef.current.uTime) {
                uniformRef.current.uTime.value = clock.getElapsedTime();
            }
        });

        /* 4. When the incoming uniforms prop changes, update only .value */
        useEffect(() => {
            for (const [key, val] of Object.entries(uniforms)) {
                if (uniformRef.current[key]) {
                    // Existing key: update its value
                    uniformRef.current[key].value = val;
                } else {
                    // New key: add it
                    uniformRef.current[key] = { value: val };
                }
            }
        }, [uniforms]);

        /* 5. Render the Three.js <shaderMaterial> */
        return (
            <shaderMaterial
                ref={materialRef}
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniformRef.current}  // reference never changes
                {...props}
            />
        );
    }
);

CustomShaderMaterial.displayName = 'CustomShaderMaterial';

export default CustomShaderMaterial;