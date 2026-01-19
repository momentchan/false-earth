import { TerrainUniforms } from '../terrain/types';
import * as THREE from 'three/webgpu';

export interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
  terrainUniforms?: TerrainUniforms;
  onTrailTextureChange?: (texture: THREE.StorageTexture | null) => void;
}

export interface CharacterState {
  currentSpeed: number;
  targetSpeed: number;
  maxSpeed: number;
  rotateSpeed: number;
  speedLerpFactor: number;
  animBlendLerpFactor: number;
  currentIdleWeight: number;
  currentWalkWeight: number;
  isMoving: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
}

