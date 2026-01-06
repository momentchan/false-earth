import CustomEffectBase from "./CustomEffectBase";

/**
 * Usage:
 * 
 * import { EffectComposer } from '@react-three/postprocessing';
 * import { SampleEffect } from '@/packages/r3f-gist/components/effects';
 * 
 * // Inside your R3F <Canvas>:
 * <EffectComposer>
 *   <SampleEffect />
 * </EffectComposer>
 */

interface SampleEffectProps {
    /** Additional properties for the effect */
    [key: string]: any;
}

class SampleEffectClass extends CustomEffectBase {
    constructor() {
        super(
            'SampleEffect',
            {
                fragmentShader: /* glsl */`
                    void mainImage(const in vec4 inputColor, in vec2 uv, out vec4 outputColor)
                    {
                        outputColor = vec4(uv, .0, 1.0);
                    }
                `,
                childUniforms: new Map(),
                vertexShader: null,
                defines: {},
            }
        );
    }
}

/**
 * SampleEffect - A simple example effect showing UV coordinates as colors
 * This is a demonstration effect for learning how to create custom effects
 */
export default function SampleEffect(props: SampleEffectProps) {
    const effect = new SampleEffectClass();

    return <primitive object={effect} {...props} />;
}


