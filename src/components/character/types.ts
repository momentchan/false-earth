import * as THREE from 'three';

export interface CharacterProps {
  position?: [number, number, number];
  scale?: number;
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

export interface CharacterTextures {
  bodyTex: {
    map: THREE.Texture;
    aoMap: THREE.Texture;
    normalMap: THREE.Texture;
    metalnessMap: THREE.Texture;
  };
  detailTex: {
    map: THREE.Texture;
    aoMap: THREE.Texture;
    normalMap: THREE.Texture;
    metalnessMap: THREE.Texture;
  };
}
