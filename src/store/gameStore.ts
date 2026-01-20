import { create } from 'zustand';

export enum CameraMode {
  TPS = 0,
  FPV = 1,
  FREE = 2,
}

interface GameState {
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleCameraMode: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  cameraMode: CameraMode.TPS,
  
  setCameraMode: (mode) => set({ cameraMode: mode }),
  
  toggleCameraMode: () => set((state) => ({ 
    cameraMode: (state.cameraMode + 1) % 3 
  })),
}));
