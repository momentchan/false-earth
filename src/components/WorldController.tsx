import { Suspense, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import {
    uTime,
    uDeltaTime,
    uGlobalHueShift,
    uWindDir,
    uWindScale,
    uWindSpeed,
    uWindStrength,
    uWindFacing,
    uTerrainAmp,
    uTerrainFreq,
    uTerrainSeed,
    uTerrainColor,
} from '../core/shaders/uniforms';
import { CosmicSystem } from './cosmic/CosmicSystem';
import { Terrain } from './Terrain';
import { StarrySky } from './background/StarrySky';
import { useGameStore } from '../core/store/gameStore';
import { AsyncCompile } from '@core';
import Rose from './Rose/Rose';
import GrassWebGPU from './grass/GrassWebGPU';
import { Character } from './character';
import { GrassCullingDebug } from '../debug/GrassCullingDebug';

export function WorldController() {
    const setActiveTargets = useGameStore((state) => state.setActiveTargets);
    const setComponentReady = useGameStore((state) => state.setComponentReady);

    const debugMode = new URLSearchParams(window.location.search).get('debug') === 'true';

    const { enableEnv, enableRose, enableGrass, enableCharacter, enableGrassDebug } = useControls('Game.Content', {
        enableEnv: { value: true, label: 'Environment' },
        enableCharacter: { value: true, label: '👤 Character' },
        enableRose: { value: true, label: '🌹 Rose Field' },
        enableGrass: { value: true, label: '🌿 Grass Field' },
        enableGrassDebug: { value: false, label: '🌿 Grass Culling Debug' },
    }, { collapsed: true });


    const { timeScale, globalHue } = useControls('Game.System', {
        timeScale: { value: 1.0, min: 0.0, max: 2.0, label: 'Game Speed' },
        globalHue: { value: 0.0, min: 0.0, max: 1.0, label: 'Global Hue' },
    });

    const [windParams] = useControls('Game.Wind', () => ({
        windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
        windDirZ: { value: -0.8, min: -1, max: 1, step: 0.01 },
        windSpeed: { value: uWindSpeed.value, min: 0, max: 3, step: 0.01 },
        windStrength: { value: uWindStrength.value, min: 0, max: 10, step: 0.01 },
        windScale: { value: uWindScale.value, min: 0.01, max: 1, step: 0.01 },
        windFacing: { value: uWindFacing.value, min: 0.0, max: 1.0, step: 0.01 },
    }), { collapsed: true });

    const [terrainParams] = useControls('Game.Terrain', () => ({
        amplitude: { value: uTerrainAmp.value, min: 0.1, max: 3.0, step: 0.1 },
        frequency: { value: uTerrainFreq.value, min: 0.01, max: 0.1, step: 0.01 },
        seed: { value: uTerrainSeed.value, min: 0.0, max: 100.0, step: 0.1 },
        color: { value: '#000000' },
    }), { collapsed: true });

    useEffect(() => {
        uWindDir.value.set(windParams.windDirX, windParams.windDirZ);
        uWindScale.value = windParams.windScale;
        uWindSpeed.value = windParams.windSpeed;
        uWindStrength.value = windParams.windStrength;
        uWindFacing.value = windParams.windFacing;
    }, [windParams]);

    useEffect(() => {
        uTerrainAmp.value = terrainParams.amplitude;
        uTerrainFreq.value = terrainParams.frequency;
        uTerrainSeed.value = terrainParams.seed;
        const c = new THREE.Color(terrainParams.color);
        uTerrainColor.value.set(c.r, c.g, c.b);
    }, [terrainParams]);

    useEffect(() => {
        const targets: string[] = [];
        if (enableRose) targets.push('rose');
        if (enableGrass) targets.push('grass');
        if (enableCharacter) targets.push('character');
        setActiveTargets(targets);
    }, [enableRose, enableGrass, enableCharacter, setActiveTargets]);

    useFrame((_state, rawDelta) => {
        const delta = Math.min(rawDelta, 0.1);
        uGlobalHueShift.value = globalHue;

        uTime.value += delta * timeScale;
        uDeltaTime.value = delta * timeScale;
    });

    return <>
        {/* Environment - use group visibility to avoid remounting */}
        <Suspense fallback={null}>
            <group visible={enableEnv}>
                <StarrySky />
                <CosmicSystem />
                <Terrain />
            </group>

            {/* Major components - toggle visibility instead of unmounting */}
            <AsyncCompile id="rose" onReady={setComponentReady} debug={debugMode}>
                <Rose count={2000} visible={enableRose} />
            </AsyncCompile>

            <AsyncCompile id="grass" onReady={setComponentReady} debug={debugMode}>
                {enableGrassDebug && <GrassCullingDebug />}
                {!enableGrassDebug && <GrassWebGPU visible={enableGrass} />}
            </AsyncCompile>


            <AsyncCompile id="character" onReady={setComponentReady} debug={debugMode}>
                <Character position={[0, 0, 0]} scale={1} visible={enableCharacter} />
            </AsyncCompile>
        </Suspense>
    </>
}