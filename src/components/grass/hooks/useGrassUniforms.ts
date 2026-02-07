import { useControls } from "leva";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { uniform, vec2, vec3 } from "three/tsl";
import { createGrassControls } from "../core/grassControls";

export function useGrassUniforms() {

    const [params] = useControls('Grass', () => createGrassControls(), { collapsed: true })


    const uniforms = useMemo(() => (
        {
            compute: {
                // Shape Parameters
                uBladeHeightMin: uniform(0.4),
                uBladeHeightMax: uniform(0.8),
                uBladeWidthMin: uniform(0.01),
                uBladeWidthMax: uniform(0.05),
                uBendAmountMin: uniform(0.2),
                uBendAmountMax: uniform(0.6),
                uBladeRandomness: uniform(new THREE.Vector3(0.3, 0.3, 0.2)),

                // Clump Parameters
                uClumpSize: uniform(0.8),
                uClumpBlendSmoothness: uniform(0.2), // Blend region width for attribute mixing
                uCenterYaw: uniform(1.0),
                uBladeYaw: uniform(1.2),
                uClumpYaw: uniform(0.5),
                uTypeTrendScale: uniform(0.1),

                // Wind Parameters
                uWindScale: uniform(0.25),
                uWindSpeed: uniform(0.6),
                uWindStrength: uniform(0.35),
                uWindFacing: uniform(0.6),

                // Culling Parameters
                uCullOffset: uniform(0.8),
                uLODNoiseScale: uniform(0.1),

                uViewProjectionMatrix: uniform(new THREE.Matrix4()),
                uCameraPosition: uniform(new THREE.Vector3()),
                uGroupOffset: uniform(new THREE.Vector3()),
                uGridIndex: uniform(new THREE.Vector2(0, 0)),
                uCharacterWorldPos: uniform(new THREE.Vector3(0, 0, 0)),
                uCharacterPushRadius: uniform(0.8),
                uCharacterPushAmount: uniform(0.3),
            },
            material: {
                uWindSwayFreqMin: uniform(0.4),
                uWindSwayFreqMax: uniform(1.5),
                uWindSwayStrength: uniform(0.1),
                uWindDistanceStart: uniform(10.0),
                uWindDistanceEnd: uniform(30.0),

                uMidSoft: uniform(0.25),
                uRimPos: uniform(0.42),
                uRimSoft: uniform(0.03),
                uBaseColor: uniform(vec3(0)),
                uTipColor: uniform(vec3(1)),
                uBladeSeedRange: uniform(vec2(0.95, 1.03)),
                uClumpSeedRange: uniform(vec2(0.9, 1.1)),
                uAOPower: uniform(0.6),
                uBaseWidth: uniform(0.35),
                uTipThin: uniform(0.9),
                uThicknessStrength: uniform(0.10),

                uGroupOffset: uniform(new THREE.Vector3(0, 0, 0)),
                uCharacterWorldPos: uniform(new THREE.Vector3(0, 0, 0)),
                uCharacterPushRadius: uniform(0.8),
                uCharacterPushAmount: uniform(0.3),
                uCharacterFlattenAmount: uniform(0.5),
                uActiveWaveCount: uniform(0.0)
            }
        }), [])

    useEffect(() => {
        uniforms.compute.uBladeHeightMin.value = params.bladeHeightMin
        uniforms.compute.uBladeHeightMax.value = params.bladeHeightMax
        uniforms.compute.uBladeWidthMin.value = params.bladeWidthMin
        uniforms.compute.uBladeWidthMax.value = params.bladeWidthMax
        uniforms.compute.uBendAmountMin.value = params.bendAmountMin
        uniforms.compute.uBendAmountMax.value = params.bendAmountMax
        uniforms.compute.uBladeRandomness.value.set(
            params.bladeRandomness.x,
            params.bladeRandomness.y,
            params.bladeRandomness.z
        )

        // Clump parameters
        uniforms.compute.uClumpSize.value = params.clumpSize
        uniforms.compute.uClumpBlendSmoothness.value = params.clumpBlendSmoothness 
        uniforms.compute.uCenterYaw.value = params.centerYaw
        uniforms.compute.uBladeYaw.value = params.bladeYaw
        uniforms.compute.uClumpYaw.value = params.clumpYaw

        // Culling parameters
        uniforms.compute.uCullOffset.value = params.cullOffset
        // LOD parameters
        uniforms.compute.uLODNoiseScale.value = params.lodNoiseScale
        // Character interaction (used in compute for push vector)
        uniforms.compute.uCharacterPushRadius.value = params.pushRadius
        uniforms.compute.uCharacterPushAmount.value = params.pushAmount
    }, [params, uniforms.compute])

    useEffect(() => {
        // Wind parameters are now managed globally via Wind component
        uniforms.material.uWindSwayFreqMin.value = params.swayFreqMin;
        uniforms.material.uWindSwayFreqMax.value = params.swayFreqMax;
        uniforms.material.uWindSwayStrength.value = params.swayStrength;
        uniforms.material.uWindDistanceStart.value = params.windDistanceStart;
        uniforms.material.uWindDistanceEnd.value = params.windDistanceEnd;

        // Width shaping uniforms
        uniforms.material.uMidSoft.value = params.midSoft;
        uniforms.material.uRimPos.value = params.rimPos;
        uniforms.material.uRimSoft.value = params.rimSoft;

        // Color uniforms
        const baseColor = new THREE.Color(params.baseColor);
        uniforms.material.uBaseColor.value.set(baseColor.r, baseColor.g, baseColor.b);

        const tipColor = new THREE.Color(params.tipColor);
        uniforms.material.uTipColor.value.set(tipColor.r, tipColor.g, tipColor.b);

        uniforms.material.uBladeSeedRange.value.set(params.bladeSeedRange.x, params.bladeSeedRange.y);
        uniforms.material.uClumpSeedRange.value.set(params.clumpSeedRange.x, params.clumpSeedRange.y);
        uniforms.material.uAOPower.value = params.aoPower;

        // Lighting uniforms
        uniforms.material.uBaseWidth.value = params.baseWidth 
        uniforms.material.uTipThin.value = params.tipThin 
        uniforms.material.uThicknessStrength.value = params.thicknessStrength 

        // Character push uniforms
        uniforms.material.uCharacterPushRadius.value = params.pushRadius 
        uniforms.material.uCharacterPushAmount.value = params.pushAmount 
        uniforms.material.uCharacterFlattenAmount.value = params.flattenAmount
    }, [params, uniforms.material])


    return {
        uniforms,
        params,
    }
}