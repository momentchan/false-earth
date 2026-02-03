'use client';

import { useEffect } from 'react';
import { useGameStore } from '../core/store/gameStore';
import WebGPUCanvas from './WebGPUCanvas'; // Import the reusable component
import DistortedCircle from './DistortedCircle';
import Bgm from '../components/audio/Bgm';

const tracks = [
    { id: 'grass_field', url: '/audio/grass_field.mp3', volume: 1.5 },
    { id: 'noise', url: '/audio/noise.m4a', volume: 0.1}
]
export default function AudioButton() {
    const isGameStarted = useGameStore((state) => state.isGameStarted);
    const isSoundOn = useGameStore((state) => state.isSoundOn);
    const setIsSoundOn = useGameStore((state) => state.setIsSoundOn);

    const radius = 10;
    const size = 45;

    useEffect(() => {
        if (isGameStarted) {
            setIsSoundOn(true);
        }
    }, [isGameStarted]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() !== 'm') return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            setIsSoundOn(!isSoundOn);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isSoundOn, setIsSoundOn]);

    return (
        <WebGPUCanvas
            width={size}
            height={size}
            style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 20 }}
        >
            {/* Interaction Layer (Invisible Hitbox) */}
            <mesh
                onClick={() => setIsSoundOn(!isSoundOn)}
                onPointerOver={() => {
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                    document.body.style.cursor = 'auto';
                }}
                visible={false} // Invisible but captures events
            >
                <circleGeometry args={[radius * 1.2, 32]} />
                <meshBasicMaterial />
            </mesh>

            <Bgm active={isSoundOn} tracks={tracks} />

            {/* Visual Layer */}
            <group>
                {[12.35, 0.58, 3.67].map((seed, i) => (
                    <DistortedCircle
                        key={i}
                        radius={radius}
                        distortionStrength={isSoundOn ? 1 : 0}
                        seed={seed}
                    />
                ))}
            </group>
        </WebGPUCanvas>
    );
}