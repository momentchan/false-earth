import { create } from 'zustand';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { TerrainUniforms } from '../components/types';
import { WindUniforms } from '../components/wind/Wind';

export enum CameraMode {
  TPS = 0,
  FREE = 1,
  FPV = 2,
}

interface GameState {
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;
  terrainUniforms: TerrainUniforms | null;
  setTerrainUniforms: (uniforms: TerrainUniforms | null) => void;
  windUniforms: WindUniforms | null;
  setWindUniforms: (uniforms: WindUniforms | null) => void;
  waveStorageBuffer: THREE.StorageBufferAttribute | null;
  setWaveStorageBuffer: (buffer: THREE.StorageBufferAttribute | null) => void;
  activeWaveCount: number;
  setActiveWaveCount: (count: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  cameraMode: CameraMode.TPS,
  
  setCameraMode: (mode) => set({ cameraMode: mode }),
  
  toggleCameraMode: () => set((state) => ({ 
    cameraMode: (state.cameraMode + 1) % 3 
  })),
  
  characterRef: null,
  setCharacterRef: (ref) => set({ characterRef: ref }),
  
  terrainUniforms: null,
  setTerrainUniforms: (uniforms) => set({ terrainUniforms: uniforms }),
  
  windUniforms: null,
  setWindUniforms: (uniforms) => set({ windUniforms: uniforms }),
  
  waveStorageBuffer: null,
  setWaveStorageBuffer: (buffer) => set({ waveStorageBuffer: buffer }),
  activeWaveCount: 0,
  setActiveWaveCount: (count) => set({ activeWaveCount: count }),
}));
