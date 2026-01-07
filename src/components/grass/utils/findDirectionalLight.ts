import * as THREE from 'three/webgpu'

export function findDirectionalLight(scene: THREE.Scene): THREE.DirectionalLight | undefined {
  return scene.children.find((child) => child.type === 'DirectionalLight') as THREE.DirectionalLight | undefined
}

