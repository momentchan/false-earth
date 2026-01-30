import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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

  useEffect(() => {
    // AudioListener acts as the 'ears' for the scene
    const listener = new THREE.AudioListener();
    const loader = new THREE.AudioLoader();
    let loadedCount = 0;

    tracks.forEach((t) => {
      const sound = new THREE.Audio(listener);
      
      loader.load(t.url, (buffer) => {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(t.volume ?? 0.5);
        
        sounds.current.set(t.id, sound);
        
        // Ensure all files are ready before allowing playback
        loadedCount++;
        if (loadedCount === tracks.length) setReady(true);
      });
    });

    return () => {
      // Clean up sound instances to avoid memory leaks
      sounds.current.forEach(s => s.isPlaying && s.stop());
      sounds.current.clear();
    };
  }, [tracks]);

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