import { useEffect, useRef, Suspense } from 'react';
import { useControls } from 'leva';
import { useCosmicBeamSpawner } from './hooks/useCosmicBeamSpawner';
import { useCosmicWaveTrigger } from './hooks/useCosmicWaveTrigger';
import { CosmicBeams, CosmicBeamsRef } from './CosmicBeams';
import { BeamAudio, BeamAudioHandle } from './BeamAudio';

export function CosmicSystem() {
  const beamsRef = useRef<CosmicBeamsRef>(null);

  const audioRef = useRef<BeamAudioHandle>(null);

  const [waveParams] = useControls('Waves', () => ({
    radiusMin: { value: 5.0, min: 1.0, max: 50.0, step: 0.5 },
    radiusMax: { value: 10.0, min: 1.0, max: 50.0, step: 0.5 },
    lifetimeMin: { value: 3.0, min: 0.5, max: 20.0, step: 0.1 },
    lifetimeMax: { value: 5.0, min: 0.5, max: 20.0, step: 0.1 },
    donutMinRadius: { value: 5.0, min: 1.0, max: 30.0, step: 0.5 },
    donutMaxRadius: { value: 15.0, min: 1.0, max: 50.0, step: 0.5 },
    autoSpawn: { value: true, label: 'Auto Spawn' },
    minSpawnInterval: { value: 2.0, min: 0.1, max: 10.0, step: 0.1, label: 'Min Interval (s)' },
    maxSpawnInterval: { value: 5.0, min: 0.1, max: 10.0, step: 0.1, label: 'Max Interval (s)' },
    speedThreshold: { value: 0.1, min: 0.01, max: 5.0, step: 0.01, label: 'Speed Threshold' },
  }), { collapsed: true });

  // Hook to handle wave triggering when beams hit
  const { onBeamHit } = useCosmicWaveTrigger({ waveParams });

  // Hook to handle automatic beam spawning
  const { spawnBeam } = useCosmicBeamSpawner({
    beamsRef,
    waveParams,
    onBeamSpawn: (position) => {
      // Trigger beam, and when it hits the ground, trigger shockwave and spawn roses
      beamsRef.current?.triggerBeam(position, (hitPos) => {
        onBeamHit(hitPos);
        audioRef.current?.playImpact(hitPos, 0.5);
      });
    },
  });

  // Handle manual keypress to trigger beam
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'z') {
        spawnBeam();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [spawnBeam]);

  return <>
    <CosmicBeams ref={beamsRef} />
    
    <Suspense fallback={null}>
      <BeamAudio ref={audioRef} />
    </Suspense>
  </>;
}
