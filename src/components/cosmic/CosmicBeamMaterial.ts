import * as THREE from "three/webgpu";
import { 
  Fn, 
  vec4, 
  uv, 
  float, 
  mix, 
  smoothstep, 
  uniform, 
  abs, 
} from "three/tsl";

export function createCosmicBeamMaterial() {
    const material = new THREE.MeshBasicNodeMaterial();
    
    material.depthWrite = true
    material.blending = THREE.AdditiveBlending;

    const uCoreColor = uniform(new THREE.Color("#ffffff"));
    const uGlowColor = uniform(new THREE.Color("#00ffff"));

    material.fragmentNode = Fn(() => {
        const vUv = uv();
        const distFromCenter = abs(vUv.x.sub(0.5)).mul(2.0);
        const coreBeam = smoothstep(float(0.4), float(0.0), distFromCenter);
        const finalColor = mix(uGlowColor, uCoreColor, coreBeam);
        return vec4(finalColor, 1);
    })();

    return { material };
}
