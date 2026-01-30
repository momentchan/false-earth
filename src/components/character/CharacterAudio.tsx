import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { useLoader } from '@react-three/fiber';
import { AudioLoader, PositionalAudio } from 'three/webgpu';
import { StepType } from './hooks/useCharacterPhysics';
import { useGameStore } from '../../core/store/gameStore';

export interface CharacterAudioHandle {
    playStep: (type: StepType, volume: number) => void;
}

const POOL_SIZE = 20;
export const CharacterAudio = forwardRef<CharacterAudioHandle>((_, ref) => {
    const listener = useGameStore((state) => state.audioListener);

    const buffers = useLoader(AudioLoader, [
        '/audio/fs_grass1.mp3',
        '/audio/fs_grass2.mp3',
        '/audio/fs_grass3.mp3',
        '/audio/fs_grass4.mp3',
        '/audio/fs_grass5.mp3',
    ]);

    const pool = useRef<PositionalAudio[]>([]);
    const poolIndex = useRef(0);

    useEffect(() => {
        pool.current.forEach((sound) => {
            if (sound ) {
                sound.setRefDistance(1.5);
            }
        });
    }, []);

    useImperativeHandle(ref, () => ({
        playStep: (type: StepType, volume: number) => {
            const sound = pool.current[poolIndex.current];

            if (sound && buffers.length > 0) {
                if (sound.isPlaying)
                    sound.stop();

                // Randomize Pitch
                const detune = (Math.random() - 0.5) * 200;
                const buffer = buffers[Math.floor(Math.random() * buffers.length)];
                sound.setBuffer(buffer);
                sound.setDetune(detune);
                sound.setVolume(volume);
                sound.play();

                poolIndex.current = (poolIndex.current + 1) % POOL_SIZE;
            }
        },
    }));

    if (!listener) return null;

    return (
        <group>
            {Array.from({ length: POOL_SIZE }).map((_, i) => (
                <positionalAudio
                    key={`walk-${i}`}
                    ref={(el) => {
                        if (el) pool.current[i] = el;
                    }}
                    args={[listener]}
                />
            ))}
        </group>
    );
});

CharacterAudio.displayName = 'CharacterAudio';