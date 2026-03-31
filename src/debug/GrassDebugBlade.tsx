import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useControls, folder } from "leva";
import * as THREE from "three/webgpu";
import { createBladeGeometry } from "../components/grass/core/grassGeometry";
import { createGrassDebugMaterial, createDebugBladeUniforms } from "./grassDebugMaterial";
import { useGrassUniforms } from "../components/grass/hooks/useGrassUniforms";

// CPU-side Bezier control point calculation matching the shader logic
function getControlPoints(height: number, bend: number, bladeType: number) {
  const discreteType = Math.floor(bladeType * 3.0);
  const p0 = new THREE.Vector3(0, 0, 0);
  const p3 = new THREE.Vector3(0, height, 0);
  let p1: THREE.Vector3, p2: THREE.Vector3;

  if (discreteType === 0) {
    p1 = new THREE.Vector3(0, height * 0.4, bend * 0.5);
    p2 = new THREE.Vector3(0, height * 0.75, bend * 0.7);
  } else if (discreteType === 1) {
    p1 = new THREE.Vector3(0, height * 0.35, bend * 0.6);
    p2 = new THREE.Vector3(0, height * 0.7, bend * 0.8);
  } else {
    p1 = new THREE.Vector3(0, height * 0.3, bend * 0.7);
    p2 = new THREE.Vector3(0, height * 0.65, bend * 1.0);
  }

  return { p0, p1, p2, p3 };
}

function evalBezier3(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number) {
  const u = 1 - t;
  return new THREE.Vector3()
    .addScaledVector(p0, u * u * u)
    .addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t)
    .addScaledVector(p3, t * t * t);
}

function rotateXZ(v: THREE.Vector3, sin: number, cos: number) {
  return new THREE.Vector3(
    v.x * cos - v.z * sin,
    v.y,
    v.x * sin + v.z * cos
  );
}

interface GrassDebugBladeProps {
  visible?: boolean;
}

const CP_COLORS = {
  p0: "#ffffff",
  p1: "#ff4444",
  p2: "#44ff44",
  p3: "#4488ff",
  handle: "#666666",
  curve: "#ffaa00",
};

export function GrassDebugBlade({ visible = true }: GrassDebugBladeProps) {
  const { scene } = useThree();

  const { uniforms: grassUniforms, params: grassParams } = useGrassUniforms();

  const bladeControls = useControls("DebugBlade", {
    windSwayStrength: { value: 0.0, min: 0.0, max: 0.1, step: 0.01 },
    posX: { value: 0, min: -10, max: 10, step: 0.1 },
    posY: { value: 0, min: -5, max: 5, step: 0.1 },
    posZ: { value: 0, min: -10, max: 10, step: 0.1 },
    width: { value: 0.04, min: 0.005, max: 0.3, step: 0.001 },
    height: { value: 0.6, min: 0.05, max: 3.0, step: 0.01 },
    bend: { value: 0.3, min: 0.0, max: 2.0, step: 0.01 },
    bladeType: { value: 0.0, min: 0.0, max: 0.99, step: 0.01 },
    rotation: { value: 0, min: -180, max: 180, step: 1 },
    windStrength: { value: 0.0, min: 0.0, max: 1.0, step: 0.01 },
    clumpSeed: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    bladeSeed: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
    segments: { value: 15, min: 1, max: 30, step: 1 },
    showControlPoints: { value: true, label: "Show Control Points" },
    cpScale: { value: 0.03, min: 0.005, max: 0.1, step: 0.005, label: "CP Size" },
    Normal: folder({
      midSoft: { value: 0.25, min: 0.0, max: 1.0, step: 0.01 },
      rimPos: { value: 0.42, min: 0.0, max: 1.0, step: 0.01 },
      rimSoft: { value: 0.03, min: 0.0, max: 0.1, step: 0.001 },
    }, { collapsed: true }),
    Terrain: folder({
      terrainNormalX: { value: 0, min: -1, max: 1, step: 0.01 },
      terrainNormalZ: { value: 0, min: -1, max: 1, step: 0.01 },
    }, { collapsed: true }),
    Push: folder({
      pushX: { value: 0, min: -1, max: 1, step: 0.01 },
      pushY: { value: 0, min: -1, max: 1, step: 0.01 },
    }, { collapsed: true }),
  });

  const { bladeUniforms, mesh } = useMemo(() => {
    const bladeUniforms = createDebugBladeUniforms();

    const geometry = createBladeGeometry(bladeControls.segments);

    const { material } = createGrassDebugMaterial(
      bladeUniforms,
      grassUniforms.material,
    );

    if (scene.environment) {
      material.envMap = scene.environment;
    }

    material.roughness = grassParams.roughness ?? 0.3;
    material.metalness = grassParams.metalness ?? 0.5;
    material.emissive = new THREE.Color(grassParams.emissive);
    material.envMapIntensity = grassParams.envMapIntensity ?? 0.5;
    // material.wireframe = true;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = false;
    mesh.castShadow = false;

    return { bladeUniforms, mesh };
  }, [bladeControls.segments, grassUniforms.material, scene.environment]);

  // Sync blade uniforms from leva controls
  useEffect(() => {
    (bladeUniforms.uInstancePos as any).value.set(
      bladeControls.posX,
      bladeControls.posY,
      bladeControls.posZ
    );
    bladeUniforms.uWidth.value = bladeControls.width;
    bladeUniforms.uHeight.value = bladeControls.height;
    bladeUniforms.uBend.value = bladeControls.bend;
    bladeUniforms.uBladeType.value = bladeControls.bladeType;
    bladeUniforms.uWindStrength.value = bladeControls.windStrength;
    grassUniforms.material.uWindSwayStrength.value = bladeControls.windSwayStrength;
    grassUniforms.material.uMidSoft.value = bladeControls.midSoft;
    grassUniforms.material.uRimPos.value = bladeControls.rimPos;
    grassUniforms.material.uRimSoft.value = bladeControls.rimSoft;
    bladeUniforms.uClumpSeed.value = bladeControls.clumpSeed;
    bladeUniforms.uBladeSeed.value = bladeControls.bladeSeed;
    (bladeUniforms.uTerrainNormalXZ as any).value.set(
      bladeControls.terrainNormalX,
      bladeControls.terrainNormalZ
    );
    (bladeUniforms.uPushVector as any).value.set(
      bladeControls.pushX,
      bladeControls.pushY
    );

    const rad = (bladeControls.rotation * Math.PI) / 180;
    bladeUniforms.uRotSin.value = Math.sin(rad);
    bladeUniforms.uRotCos.value = Math.cos(rad);
  }, [bladeControls, bladeUniforms]);

  // Sync material properties from grass params
  useEffect(() => {
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardNodeMaterial;
    mat.roughness = grassParams.roughness ?? 0.3;
    mat.metalness = grassParams.metalness ?? 0.5;
    mat.emissive = new THREE.Color(grassParams.emissive);
    mat.envMapIntensity = grassParams.envMapIntensity ?? 0.5;
  }, [mesh, grassParams.roughness, grassParams.metalness, grassParams.emissive, grassParams.envMapIntensity]);

  // Cleanup
  useEffect(() => {
    if (!mesh) return;
    return () => {
      mesh.geometry?.dispose();
      (mesh.material as THREE.MeshStandardNodeMaterial)?.dispose();
    };
  }, [mesh]);

  // Compute control points on CPU (matches shader logic, pre-rotation)
  const cpData = useMemo(() => {
    const { height, bend, bladeType, rotation, posX, posY, posZ } = bladeControls;
    const rad = (rotation * Math.PI) / 180;
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const origin = new THREE.Vector3(posX, posY, posZ);

    const { p0, p1, p2, p3 } = getControlPoints(height, bend, bladeType);

    // Rotate all points around Y and offset to world position
    const toWorld = (v: THREE.Vector3) => rotateXZ(v, s, c).add(origin);
    const wp0 = toWorld(p0);
    const wp1 = toWorld(p1);
    const wp2 = toWorld(p2);
    const wp3 = toWorld(p3);

    // Sample the curve for the spine line
    const curveSamples = 32;
    const curvePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= curveSamples; i++) {
      const t = i / curveSamples;
      const pt = evalBezier3(p0, p1, p2, p3, t);
      curvePoints.push(toWorld(pt));
    }

    return { wp0, wp1, wp2, wp3, curvePoints };
  }, [
    bladeControls.height, bladeControls.bend, bladeControls.bladeType,
    bladeControls.rotation, bladeControls.posX, bladeControls.posY, bladeControls.posZ,
  ]);

  // Update line geometries reactively
  const handleLineRef = useRef<THREE.BufferGeometry>(null);
  const curveLineRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (handleLineRef.current) {
      const pts = [cpData.wp0, cpData.wp1, cpData.wp2, cpData.wp3];
      handleLineRef.current.setFromPoints(pts);
    }
    if (curveLineRef.current) {
      curveLineRef.current.setFromPoints(cpData.curvePoints);
    }
  }, [cpData]);

  if (!mesh) return null;

  const showCP = bladeControls.showControlPoints;
  const cpSize = bladeControls.cpScale;

  return (
    <group visible={visible}>
      <primitive object={mesh} />

      {showCP && (
        <group>
          {/* Control point spheres */}
          {([
            { pos: cpData.wp0, color: CP_COLORS.p0, label: "P0 (base)" },
            { pos: cpData.wp1, color: CP_COLORS.p1, label: "P1" },
            { pos: cpData.wp2, color: CP_COLORS.p2, label: "P2" },
            { pos: cpData.wp3, color: CP_COLORS.p3, label: "P3 (tip)" },
          ] as const).map(({ pos, color, label }) => (
            <group key={label} position={pos}>
              <mesh>
                <sphereGeometry args={[cpSize, 8, 8]} />
                <meshBasicMaterial color={color} depthTest={false} />
              </mesh>
              <Html
                center
                distanceFactor={3}
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  fontWeight: 600,
                  color,
                  textShadow: "0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)",
                  transform: "translateY(-16px)",
                }}
              >
                {label}
              </Html>
            </group>
          ))}

          {/* Handle lines: P0→P1→P2→P3 */}
          <line>
            <bufferGeometry ref={handleLineRef} />
            <lineBasicMaterial
              color={CP_COLORS.handle}
              depthTest={false}
              transparent
              opacity={0.5}
            />
          </line>

          {/* Bezier curve spine */}
          <line>
            <bufferGeometry ref={curveLineRef} />
            <lineBasicMaterial
              color={CP_COLORS.curve}
              depthTest={false}
              linewidth={2}
            />
          </line>
        </group>
      )}
    </group>
  );
}
