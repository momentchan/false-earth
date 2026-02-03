// src/components/cosmic/CosmicBeams.tsx
import { useRef, useMemo, useImperativeHandle, forwardRef, useEffect, useContext } from "react";
import { useFrame, createPortal } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import gsap from "gsap";
import { MAX_BEAMS, BEAM_HEIGHT, DROP_HEIGHT } from "./config";

import {
  Fn,
  vec3,
  vec4,
  uv,
  float,
  mix,
  smoothstep,
  uniform,
  abs,
} from "three/tsl";
import { uGlobalHueShift } from "../../core/shaders/uniforms";
import { shiftHSV } from "../../core/shaders/colorHelper";
import { BeamSceneContext } from "../../app/App";
function createCosmicBeamMaterial() {
  const material = new THREE.MeshBasicNodeMaterial();
  material.depthWrite = true;
  material.blending = THREE.AdditiveBlending;
  material.transparent = true;

  const uCoreColor = uniform(new THREE.Color("#ffffff"));
  const uGlowColor = uniform(new THREE.Color("#00ffff"));

  material.fragmentNode = Fn(() => {
    const vUv = uv();

    const distFromCenter = abs(vUv.x.sub(0.5)).mul(2.0);
    const coreBeam = smoothstep(float(0.4), float(0.0), distFromCenter);

    const finalColor = mix(uGlowColor, uCoreColor, coreBeam);
    const hueShifted = shiftHSV(
      finalColor,
      vec3(uGlobalHueShift, float(0.0), float(0.0))
    );

    const fade = smoothstep(float(0.0), float(0.2), vUv.y).mul(
      smoothstep(float(1.0), float(0.8), vUv.y)
    );

    return vec4(hueShifted, fade);
  })();

  return { material };
}

export interface CosmicBeamsRef {
  triggerBeam: (
    position: THREE.Vector3,
    onHit?: (position: THREE.Vector3) => void
  ) => void;
  getBeamPositions: () => THREE.Vector3[];
}

export const CosmicBeams = forwardRef<CosmicBeamsRef, {}>((_props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const beams = useMemo(
    () =>
      Array.from({ length: MAX_BEAMS }).map(() => ({
        position: new THREE.Vector3(),
        y: -5000,
        scaleWidth: 0,
        isAnimating: false,
      })),
    []
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const beamScene = useContext(BeamSceneContext);
  const { material } = useMemo(() => createCosmicBeamMaterial(), []);

  const startBeamAnimation = (
    position: THREE.Vector3,
    onHit?: (position: THREE.Vector3) => void
  ) => {
    const beam = beams.find((b) => !b.isAnimating);
    if (!beam) return;

    beam.isAnimating = true;
    beam.position.copy(position);
    beam.y = position.y + DROP_HEIGHT;
    beam.scaleWidth = 0.1;

    const tl = gsap.timeline({
      onComplete: () => {
        beam.isAnimating = false;
        beam.y = -5000;
      },
    });

    tl.to(beam, {
      y: position.y + BEAM_HEIGHT / 2,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        if (onHit) onHit(position);
      },
    });

    tl.to(beam, {
      scaleWidth: 0,
      duration: 0.3,
      ease: "power2.out",
    });
  };

  useImperativeHandle(ref, () => ({
    triggerBeam: startBeamAnimation,
    getBeamPositions: () =>
      beams.filter((b) => b.isAnimating).map((b) => b.position.clone()),
  }));

  useEffect(() => {
    if (!meshRef.current) return;
    dummy.position.set(0, -5000, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < MAX_BEAMS; i++) {
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(() => {
    if (!meshRef.current) return;
    let needsUpdate = false;

    beams.forEach((beam, i) => {
      if (beam.isAnimating) {
        dummy.position.copy(beam.position);
        dummy.position.y = beam.y;
        dummy.scale.set(beam.scaleWidth, 1, beam.scaleWidth);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      } else {
        dummy.position.set(0, -5000, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current!.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
      }
    });

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  const mesh = (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, MAX_BEAMS]}
      frustumCulled={false}
    >
      <cylinderGeometry args={[1, 1, BEAM_HEIGHT, 8]} />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );

  if (!beamScene) return mesh;
  return createPortal(mesh, beamScene);
});

CosmicBeams.displayName = "CosmicBeams";
