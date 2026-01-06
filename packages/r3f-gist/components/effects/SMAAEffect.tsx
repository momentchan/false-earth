import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useControls } from "leva";

interface SMAASize {
    width: number;
    height: number;
}

interface CreateSMAAMaterialOptions {
    debugMode?: boolean;
    edgeThreshold?: number;
}

// SMAA shader code
export const smaaVertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const smaaFragmentShader = /* glsl */`
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform bool debugMode;
  uniform float edgeThreshold;
  uniform float smaaBlend;
  varying vec2 vUv;

  // === Constants ===
  const int SAMPLE_COUNT = 8;

  // === Utility Functions ===
  float rgb2luma(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  }

  // === Sampling Functions ===
  struct Sample {
    vec4 color;
    float weight;
  };

  Sample getSample(vec2 offset) {
    vec2 delta = vec2(1.0 / resolution.x, 1.0 / resolution.y);
    vec4 color = texture2D(tDiffuse, vUv + offset * delta);
    return Sample(color, 1.0);
  }

  // === Edge Detection ===
  float detectEdge(float luma, float lumaNeighbor) {
      float diff = abs(luma - lumaNeighbor);
      return smoothstep(edgeThreshold * 0.5, edgeThreshold * 1.5, diff);
    // return step(edgeThreshold, abs(luma - lumaNeighbor));
  }

  // === Main Function ===
  void main() {
    // Get center sample
    Sample center = getSample(vec2(0.0));
    float centerLuma = rgb2luma(center.color.rgb);
    
    // Sample neighbors
    Sample samples[SAMPLE_COUNT];
    samples[0] = getSample(vec2(-1.0,  0.0));  // Left
    samples[1] = getSample(vec2( 1.0,  0.0));  // Right
    samples[2] = getSample(vec2( 0.0, -1.0));  // Top
    samples[3] = getSample(vec2( 0.0,  1.0));  // Bottom
    samples[4] = getSample(vec2(-1.0, -1.0));  // TopLeft
    samples[5] = getSample(vec2( 1.0, -1.0));  // TopRight
    samples[6] = getSample(vec2(-1.0,  1.0));  // BottomLeft
    samples[7] = getSample(vec2( 1.0,  1.0));  // BottomRight

    // Calculate weights
    float totalWeight = 1.0;
    vec4 blendedColor = center.color;

    for(int i = 0; i < SAMPLE_COUNT; i++) {
        float neighborLuma = rgb2luma(samples[i].color.rgb);
        float edge = detectEdge(centerLuma, neighborLuma);
        float weight = 1.0 - edge;

        
        samples[i].weight = weight;
        totalWeight += weight;
        blendedColor += samples[i].color * weight;
    }

    // Normalize result
    blendedColor /= totalWeight;

    vec3 debug = abs(blendedColor.rgb - center.color.rgb);

    // Debug visualization
    if (debugMode) {
        // Show difference between original and anti-aliased
        gl_FragColor = vec4(debug * 10.0, center.color.a);
    } else {
        // Normal output
        gl_FragColor = vec4(mix(center.color.rgb, blendedColor.rgb, smaaBlend) , center.color.a);
    }
  }
`;

/**
 * Utility function to create SMAA material
 */
export function createSMAAMaterial(
    size: SMAASize,
    { debugMode = false, edgeThreshold = 0.1 }: CreateSMAAMaterialOptions = {}
): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: smaaVertexShader,
        fragmentShader: smaaFragmentShader,
        uniforms: {
            tDiffuse: { value: null },
            resolution: { value: new THREE.Vector2(size.width, size.height) },
            debugMode: { value: debugMode },
            edgeThreshold: { value: edgeThreshold },
            smaaBlend: { value: 0.5 }
        }
    });
}

interface SMAAEffectProps {
    /** Whether to show debug visualization */
    debugMode?: boolean;
    /** Edge detection threshold */
    edgeThreshold?: number;
    /** SMAA blend factor */
    smaaBlend?: number;
    /** Additional props */
    [key: string]: any;
}

/**
 * SMAAEffect - Custom SMAA (Subpixel Morphological Anti-Aliasing) implementation
 * Provides high-quality anti-aliasing with configurable parameters
 */
export default function SMAAEffect({
    debugMode = false,
    edgeThreshold = 0.1,
    smaaBlend = 0.5,
    ...props
}: SMAAEffectProps) {
    // This would be a React component implementation
    // Note: This is a placeholder - the actual SMAA effect would need to be integrated
    // with postprocessing or implemented as a custom effect
    console.warn('SMAAEffect: This is a placeholder implementation. Please integrate with postprocessing library.');

    return null;
}
