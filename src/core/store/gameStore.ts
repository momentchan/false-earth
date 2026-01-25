import { create } from 'zustand';
import { Group } from 'three';
import * as THREE from 'three/webgpu';
import { TerrainUniforms, WindUniforms } from '../types';
import { RoseHandle } from '../components/Rose/Rose';

export enum CameraMode {
  TPS = 0,
  FREE = 1,
  FPV = 2,
}

interface GameState {
  // ===== Camera State =====
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  
  // ===== Character State =====
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;
  
  // ===== Terrain State =====
  terrainUniforms: TerrainUniforms | null;
  setTerrainUniforms: (uniforms: TerrainUniforms | null) => void;
  
  // ===== Wind State =====
  windUniforms: WindUniforms | null;
  setWindUniforms: (uniforms: WindUniforms | null) => void;
  
  // ===== Cosmic/Wave State =====
  waveStorageBuffer: THREE.StorageBufferAttribute | null;
  setWaveStorageBuffer: (buffer: THREE.StorageBufferAttribute | null) => void;
  activeWaveCount: number;
  setActiveWaveCount: (count: number) => void;
  roseRef: React.MutableRefObject<RoseHandle | null> | null;
  setRoseRef: (ref: React.MutableRefObject<RoseHandle | null> | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // ===== Camera State =====
  cameraMode: CameraMode.TPS,
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleCameraMode: () => set((state) => ({
    cameraMode: (state.cameraMode + 1) % 3
  })),
  
  // ===== Character State =====
  characterRef: null,
  setCharacterRef: (ref) => set({ characterRef: ref }),
  
  // ===== Terrain State =====
  terrainUniforms: null,
  setTerrainUniforms: (uniforms) => set({ terrainUniforms: uniforms }),
  
  // ===== Wind State =====
  windUniforms: null,
  setWindUniforms: (uniforms) => set({ windUniforms: uniforms }),
  
  // ===== Cosmic/Wave State =====
  waveStorageBuffer: null,
  setWaveStorageBuffer: (buffer) => set({ waveStorageBuffer: buffer }),
  activeWaveCount: 0,
  setActiveWaveCount: (count) => set({ activeWaveCount: count }),
  roseRef: null,
  setRoseRef: (ref) => set({ roseRef: ref }),
}));
