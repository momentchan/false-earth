import { useThree } from "@react-three/fiber";
import { useState, useMemo } from "react";
import { SSAOPass } from "three-stdlib";
import { EffectComposer, N8AO, SMAA } from "@react-three/postprocessing";
import { Effects as EffectComposer2 } from "@react-three/drei";
import { EffectPass } from "postprocessing";

// Optional realism-effects dependency
let VelocityDepthNormalPass: any, SSGIEffect: any, TRAAEffect: any, isRealismEffectsAvailable = false;

// Fallback components
const FallbackComponent = ({ children, ...props }: any) => <group {...props}>{children}</group>;
FallbackComponent.displayName = 'FallbackVelocityDepthNormalPass';

// Initialize with fallbacks
VelocityDepthNormalPass = FallbackComponent;
SSGIEffect = class SSGIEffectFallback { constructor() { } };
TRAAEffect = class TRAAEffectFallback { constructor() { } };

// Try to load realism-effects if available
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const realismEffects = require('realism-effects');
    VelocityDepthNormalPass = realismEffects.VelocityDepthNormalPass;
    SSGIEffect = realismEffects.SSGIEffect;
    TRAAEffect = realismEffects.TRAAEffect;
    isRealismEffectsAvailable = true;
} catch {
    console.warn('RealisticEffect: realism-effects not found. SSGI effects will be disabled.');
}

interface RealisticEffectProps {
    [key: string]: any;
}

/**
 * SSAOEffects - Screen Space Ambient Occlusion effects
 */
export function SSAOEffects(props: RealisticEffectProps) {
    const { scene, camera } = useThree();
    const ssaoPass = useMemo(() => new SSAOPass(scene, camera, 100, 100), [scene, camera]);

    // Configure SSAO pass
    ssaoPass.kernelRadius = 1.2;
    ssaoPass.kernelSize = 0;

    return (
        <EffectComposer2 {...props}>
            <primitive object={ssaoPass} />
        </EffectComposer2>
    );
}

/**
 * N8Effects - N8AO (Next-generation Ambient Occlusion) effects
 */
export function N8Effects(props: RealisticEffectProps) {
    return (
        <EffectComposer multisampling={0} {...props}>
            <N8AO aoRadius={2} intensity={2} aoSamples={6} denoiseSamples={4} />
            <SMAA />
        </EffectComposer>
    );
}

/**
 * SSGIEffects - Screen Space Global Illumination effects with TRAA
 */
export function SSGIEffects(props: RealisticEffectProps) {
    const { scene, camera } = useThree();

    const effects = useMemo(() => {
        if (!isRealismEffectsAvailable) {
            console.warn('SSGIEffects: realism-effects is required but not installed');
            return null;
        }

        const velocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera);
        const ssgiEffect = new SSGIEffect(scene, camera, velocityDepthNormalPass);
        const traaEffect = new TRAAEffect(scene, camera, velocityDepthNormalPass);

        return {
            velocityDepthNormalPass,
            ssgiPass: new EffectPass(camera, ssgiEffect),
            traaPass: new EffectPass(camera, traaEffect)
        };
    }, [scene, camera]);

    if (!isRealismEffectsAvailable || !effects) {
        return <EffectComposer {...props}><SMAA /></EffectComposer>;
    }

    return (
        <EffectComposer {...props}>
            <primitive object={effects.velocityDepthNormalPass} />
            <primitive object={effects.ssgiPass} />
            <primitive object={effects.traaPass} />
        </EffectComposer>
    );
}

// Legacy exports for backward compatibility
export const RealisticEffects = SSGIEffects;
export const MotionBlurEffects = SSGIEffects;
export const TRAAEffects = SSGIEffects;
