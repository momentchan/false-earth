import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../core/store/gameStore';
import * as THREE from 'three/webgpu';

interface Track {
  id: string;
  url: string;
  volume?: number;
}

interface BgmProps {
  active: boolean;
  tracks: Track[];
}

const Bgm = ({ active, tracks }: BgmProps) => {
  const sounds = useRef<Map<string, THREE.Audio>>(new Map());
  const [ready, setReady] = useState(false);
  const listener = useGameStore((state) => state.audioListener);  

  useEffect(() => {
    if (!listener) return;

    const loader = new THREE.AudioLoader();
    let loadedCount = 0;

    tracks.forEach((t) => {
      const sound = new THREE.Audio(listener);
      
      loader.load(t.url, (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(t.volume ?? 0.5);
        
        sounds.current.set(t.id, sound);
        
        loadedCount++;
        if (loadedCount === tracks.length) setReady(true);
      });
    });

    return () => {
      // Clean up sound instances to avoid memory leaks
      sounds.current.forEach(s => s.isPlaying && s.stop());
      sounds.current.clear();
    };
  }, [tracks, listener]);

  useEffect(() => {
    // Sync playback state with the game status
    if (active && ready) {
      sounds.current.forEach(s => !s.isPlaying && s.play());
    } else {
      sounds.current.forEach(s => s.isPlaying && s.pause());
    }
  }, [active, ready]);

  return null;
};

export default Bgm;