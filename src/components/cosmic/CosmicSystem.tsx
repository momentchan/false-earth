// src/components/cosmic/CosmicSystem.tsx
// Orchestrator component that coordinates beams and waves
import { useEffect, useMemo, useRef } from 'react';
import { useControls } from 'leva';
import * as THREE from 'three/webgpu';
import { useCosmicWaves } from "./useCosmicWaves";
import { MathUtils } from 'three';
import { useGameStore } from '../../store/gameStore';
import { CosmicBeams, CosmicBeamsRef } from './CosmicBeams';

export function CosmicSystem() {
    const { triggerShockwave } = useCosmicWaves();
    const characterRef = useGameStore((state) => state.characterRef);
    const beamsRef = useRef<CosmicBeamsRef>(null);
    
    const characterPos = useMemo(() => new THREE.Vector3(), []);

    const [waveParams] = useControls('Waves', () => ({
        radiusMin: { value: 5.0, min: 1.0, max: 50.0, step: 0.5 },
        radiusMax: { value: 10.0, min: 1.0, max: 50.0, step: 0.5 },
        lifetimeMin: { value: 3.0, min: 0.5, max: 20.0, step: 0.1 },
        lifetimeMax: { value: 5.0, min: 0.5, max: 20.0, step: 0.1 },
        donutMinRadius: { value: 5.0, min: 1.0, max: 30.0, step: 0.5 },
        donutMaxRadius: { value: 15.0, min: 1.0, max: 50.0, step: 0.5 },
    }), { collapsed: true });

    // Handle keypress to trigger beam, then wave on completion
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'z') {
                // Get character world position
                if (!characterRef?.current) {
                    console.warn('Character ref not available, spawning beam at origin');
                    characterPos.set(0, 0, 0);
                } else {
                    characterRef.current.getWorldPosition(characterPos);
                }

                const angle = Math.random() * Math.PI * 2;
                const distance = MathUtils.lerp(waveParams.donutMinRadius, waveParams.donutMaxRadius, Math.random());
                
                const position = new THREE.Vector3(
                    characterPos.x + Math.cos(angle) * distance,
                    0,
                    characterPos.z + Math.sin(angle) * distance
                );

                // Trigger beam, and when it completes, trigger shockwave
                beamsRef.current?.triggerBeam(position, (beamPosition) => {
                    // Calculate wave parameters when beam hits the ground
                    const radius = MathUtils.lerp(waveParams.radiusMin, waveParams.radiusMax, Math.random());
                    const lifetime = MathUtils.lerp(waveParams.lifetimeMin, waveParams.lifetimeMax, Math.random());
                    
                    // Trigger shockwave at impact position
                    triggerShockwave(beamPosition, radius, lifetime);
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [triggerShockwave, waveParams, characterRef, characterPos]);

    return <CosmicBeams ref={beamsRef} />;
}
