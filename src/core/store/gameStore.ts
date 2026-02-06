import { create } from 'zustand';
import { Group } from 'three';
import { AudioListener } from 'three/webgpu';
import * as THREE from 'three/webgpu';

export enum CameraMode {
  Follow  = 0,
  FPV = 1,
  Detached = 2,
}

interface GameState {
  // ===== Camera State =====
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
  
  // ===== Character State =====
  characterRef: React.MutableRefObject<Group | null> | null;
  setCharacterRef: (ref: React.MutableRefObject<Group | null> | null) => void;

  activeTargets: string[];
  setActiveTargets: (targets: string[]) => void;

  readyStatus: Record<string, boolean>;
  setComponentReady: (id: string, isReady: boolean) => void;

  isSceneReady: () => boolean;

  isGameStarted: boolean;
  setIsGameStarted: (loaded: boolean) => void;

  isSoundOn: boolean;
  setIsSoundOn: (isSoundOn: boolean) => void;

  audioListener: AudioListener | null;
  setAudioListener: (listener: THREE.AudioListener) => void;

  isMobile: boolean;
  setIsMobile: (isMobile: boolean) => void;

  quality: 'low' | 'high';
  toggleQuality: () => void;

  isControlEnabled: boolean; 
  setControlEnabled: (enabled: boolean) => void;

  // ===== WebGPU State =====
  gpuError: string | null;
  setGpuError: (error: string | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // ===== Camera State =====
  cameraMode: CameraMode.Follow,
  setCameraMode: (mode) => set({ cameraMode: mode }),
  toggleCameraMode: () => set((state) => ({
    cameraMode: (state.cameraMode + 1) % 3
  })),
  
  // ===== Character State =====
  characterRef: null,
  setCharacterRef: (ref) => set({ characterRef: ref }),

  activeTargets: [],
  setActiveTargets: (targets) => set({ activeTargets: targets }),

  readyStatus: {},
  setComponentReady: (id, isReady) => set((state) => ({
    readyStatus: { ...state.readyStatus, [id]: isReady }
  })),

  isSceneReady: () => {
    const { activeTargets, readyStatus } = get();
    if (activeTargets.length === 0) return false;
    return activeTargets.every((target) => readyStatus[target] === true);
  },

  isGameStarted: false,
  setIsGameStarted: (loaded) => set({ isGameStarted: loaded }),

  isSoundOn: false,
  setIsSoundOn: (isSoundOn) => set({ isSoundOn: isSoundOn }),

  audioListener: null,
  setAudioListener: (listener) => set({ audioListener: listener }),

  isMobile: false,
  setIsMobile: (isMobile) => set({ isMobile: isMobile }),

  quality: 'high',
  toggleQuality: () => set((state) => ({ quality: state.quality === 'high' ? 'low' : 'high' })),

  isControlEnabled: false,
  setControlEnabled: (enabled) => set({ isControlEnabled: enabled }),

  // ===== WebGPU State =====
  gpuError: null,
  setGpuError: (error) => set({ gpuError: error }),
}));
