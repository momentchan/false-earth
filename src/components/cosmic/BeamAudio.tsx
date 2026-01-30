import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import { useThree, useLoader } from '@react-three/fiber';
import { AudioLoader, AudioListener, PositionalAudio } from 'three/webgpu';
import * as THREE from 'three';

export interface BeamAudioHandle {
    playImpact: (position: THREE.Vector3, volume?: number) => void;
}

const POOL_SIZE = 10;
const REF_DISTANCE = 5;

export const BeamAudio = forwardRef<BeamAudioHandle>((_, ref) => {
    const { camera } = useThree();
    
    const [listener] = useState(() => new AudioListener());

    const buffers = useLoader(AudioLoader, [
        '/audio/wave01.mp3', 
    ]);

    const pool = useRef<PositionalAudio[]>([]);
    const poolIndex = useRef(0);

    useEffect(() => {
        camera.add(listener);
        return () => {
            camera.remove(listener);
        };
    }, [camera, listener]);

    useEffect(() => {
        pool.current.forEach((sound) => {
            if (sound) {
                sound.setRefDistance(REF_DISTANCE);
                sound.setRolloffFactor(1); 
            }
        });
    }, []);

    useImperativeHandle(ref, () => ({
        playImpact: (position: THREE.Vector3, volume: number = 1) => {
            const sound = pool.current[poolIndex.current];

            if (sound && buffers.length > 0) {
                if (sound.isPlaying) sound.stop();

                sound.position.copy(position);
                sound.updateMatrixWorld();

                const detune = (Math.random() - 0.5) * 300; 
                const buffer = buffers[Math.floor(Math.random() * buffers.length)];
                sound.setBuffer(buffer);
                sound.setDetune(detune);
                sound.setVolume(volume);
                sound.play();

                poolIndex.current = (poolIndex.current + 1) % POOL_SIZE;
            }
        },
    }));

    return (
        <group>
            {Array.from({ length: POOL_SIZE }).map((_, i) => (
                <positionalAudio
                    key={`beam-impact-${i}`}
                    ref={(el) => {
                        if (el) pool.current[i] = el;
                    }}
                    args={[listener]}
                />
            ))}
        </group>
    );
});

BeamAudio.displayName = 'BeamAudio';