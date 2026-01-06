'use client';

import { useRef, useMemo, forwardRef, useImperativeHandle, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useFBO } from '@react-three/drei';
import * as THREE from 'three';
import { useControls } from 'leva';

interface MouseTraceFBOProps {
  width?: number;
  height?: number;
  showDebug?: boolean;
  downsample?: number;
}

type MouseTraceFBORef = {
  getFBOTexture: () => THREE.Texture | null;
  clearTraces?: () => void;
};

const MouseTraceFBO = forwardRef<MouseTraceFBORef, MouseTraceFBOProps>(({ showDebug = true, downsample = 1 }, ref) => {
  const { gl, size, pointer } = useThree();

  const [isDrawing, setIsDrawing] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<THREE.Vector2 | null>(null);
  const [mouseSpeed, setMouseSpeed] = useState(0);

  // ---------- Index: Clear separation of read / write ----------
  const readIndex = useRef(0);
  const writeIndex = useRef(1);
  const swap = () => {
    const t = readIndex.current;
    readIndex.current = writeIndex.current;
    writeIndex.current = t;
  };

  const debugMatRef = useRef<THREE.ShaderMaterial | null>(null);

  // Control panel
  const controls = useControls('Mouse Trace FBO', {
    drawingMode: {
      value: 'fast',
      options: { 'Draw on Press': 'press', 'Draw Always': 'always', 'Draw when Fast': 'fast' }
    },
    traceSize: { value: 0.04, min: 0.001, max: 0.1, step: 0.001 },
    traceOpacity: { value: 0.8, min: 0.0, max: 1.0, step: 0.01 },
    fadeSpeed: { value: 0.98, min: 0.8, max: 0.995, step: 0.001 },
    traceColor: { value: '#ffffff' },
    clearOnRelease: { value: false },
    showDebug: { value: showDebug },
    diffusion: { value: 0.1, min: 0.0, max: 1.0, step: 0.01 },
    velocity: { value: 0.5, min: 0.0, max: 2.0, step: 0.01 },
    pressure: { value: 1.0, min: 0.0, max: 2.0, step: 0.01 },
    curl: { value: 0.0, min: -1.0, max: 1.0, step: 0.01 },
    speedThreshold: { value: 0.5, min: 0.0, max: 2.0, step: 0.01 },
  });

  // FBO (using actual DPR and downsample)
  const dpr = gl.getPixelRatio();
  const w = Math.max(1920, Math.floor(size.width * dpr / downsample));
  const h = Math.max(1080, Math.floor(size.height * dpr / downsample));
  const fboA = useFBO(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false,
  });
  const fboB = useFBO(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false,
  });
  const fbos = [fboA, fboB];

  // Ping-pong shader (GPGPU → NoBlending)
  const pingPongMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uPreviousTexture;
        uniform float uTime;
        uniform float uDeltaTime;
        uniform vec2 uResolution;
        uniform float uDiffusion;
        uniform float uFadeSpeed;
        uniform vec3 uTraceColor;
        uniform float uTraceOpacity;
        uniform float uTraceSize;
        uniform vec2 uMousePosition;
        uniform float uMousePressure;
        uniform float uCurl;
        uniform bool uIsDrawing;

        varying vec2 vUv;

        float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        vec2 curlNoise(vec2 p) {
          float e = 0.1;
          float n1 = random(p + vec2(e, 0.0));
          float n2 = random(p - vec2(e, 0.0));
          float n3 = random(p + vec2(0.0, e));
          float n4 = random(p - vec2(0.0, e));
          float dx = (n1 - n2) / (2.0 * e);
          float dy = (n3 - n4) / (2.0 * e);
          return vec2(dy, -dx);
        }

        void main() {
          vec2 uv = vUv;
          vec2 texelSize = 1.0 / uResolution;

          vec4 previous = texture2D(uPreviousTexture, uv);

          // Gaussian-like blur
          vec4 blurred = vec4(0.0);
          float totalWeight = 0.0;
          for (int x = -2; x <= 2; x++) {
            for (int y = -2; y <= 2; y++) {
              vec2 offset = vec2(float(x), float(y)) * texelSize;
              float weight = exp(-dot(offset, offset) / (2.0 * uDiffusion * uDiffusion + 1e-6));
              blurred += texture2D(uPreviousTexture, uv + offset) * weight;
              totalWeight += weight;
            }
          }
          blurred /= max(totalWeight, 1e-6);

          // curl advection
          vec2 curlForce = curlNoise(uv * 10.0 + uTime * 0.1) * uCurl;
          vec2 advectedUV = clamp(uv - curlForce * uDeltaTime * 0.1, 0.0, 1.0);
          vec4 advected = texture2D(uPreviousTexture, advectedUV);

          vec4 fluid = mix(blurred, advected, 0.7);
          fluid *= uFadeSpeed;

          vec4 mouseInput = vec4(0.0);
          if (uIsDrawing) {
            float aspect = uResolution.x / uResolution.y;
            vec2 acUV = uv;
            vec2 acMouse = uMousePosition;
            
            // Proper aspect ratio correction for both landscape and portrait
            if (aspect >= 1.0) {
              // Landscape: scale x to match aspect ratio
              acUV.x = acUV.x * aspect;
              acMouse.x = acMouse.x * aspect;
            } else {
              // Portrait: scale y to match aspect ratio
              acUV.y = acUV.y / aspect;
              acMouse.y = acMouse.y / aspect;
            }
            
            float dist = distance(acUV, acMouse);
            float mouseInfluence = exp(-dist / max(uTraceSize, 1e-6)) * uMousePressure * uTraceOpacity;
            mouseInput = vec4(mouseInfluence);
          }

          vec4 result = fluid + mouseInput;
          result.r = clamp(result.r, 0.0, 1.0);
          
          gl_FragColor = result;
        }
      `,
      uniforms: {
        uPreviousTexture: { value: null },
        uTime: { value: 0.0 },
        uDeltaTime: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uDiffusion: { value: controls.diffusion },
        uFadeSpeed: { value: controls.fadeSpeed },
        uTraceColor: { value: new THREE.Color(controls.traceColor) },
        uTraceOpacity: { value: controls.traceOpacity },
        uTraceSize: { value: controls.traceSize },
        uMousePosition: { value: new THREE.Vector2(0.5, 0.5) },
        uMousePressure: { value: controls.pressure },
        uCurl: { value: controls.curl },
        uIsDrawing: { value: false },
      },
      transparent: true,
      blending: THREE.NoBlending,   // <<<<<< Important: Don't use Additive
      depthWrite: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, dpr, downsample, controls.traceColor]);

  // Cleanup FBOs on unmount
  useEffect(() => {
    return () => {
      try {
        // Dispose of both FBOs and their textures
        fbos.forEach((fbo) => {
          if (fbo) {
            if (fbo.texture) {
              fbo.texture.dispose();
            }
            fbo.dispose();
          }
        });

        // Dispose of materials
        if (pingPongMaterial) {
          pingPongMaterial.dispose();
        }
      } catch (error) {
        console.debug('MouseTraceFBO cleanup error handled');
      }
    };
  }, [fboA, fboB, pingPongMaterial]);

  // Off-screen scene/camera/quad (fixed once)
  const simScene = useMemo(() => new THREE.Scene(), []);
  const simCamera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);
  const simQuad = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pingPongMaterial);
    m.frustumCulled = false;
    return m;
  }, [pingPongMaterial]);

  useEffect(() => {
    simScene.add(simQuad);
    return () => {
      simScene.remove(simQuad);
    };
  }, [simScene, simQuad]);

  // ---------- Initialize and clear both FBOs to avoid uninitialized black screen ----------
  useEffect(() => {
    const prevColor = new THREE.Color();
    gl.getClearColor(prevColor);
    const prevAlpha = gl.getClearAlpha();

    gl.setClearColor(new THREE.Color(0, 0, 0), 1);
    [fboA, fboB].forEach((rt) => {
      gl.setRenderTarget(rt);
      gl.clear(true, true, true);
    });
    gl.setRenderTarget(null);

    gl.setClearColor(prevColor, prevAlpha as any);
  }, [gl, fboA, fboB]);

  // Synchronize FBO with resolution when window resizes
  useEffect(() => {
    const nextDpr = gl.getPixelRatio();
    const newWidth = Math.max(1920, Math.floor(size.width * nextDpr / downsample));
    const newHeight = Math.max(1080, Math.floor(size.height * nextDpr / downsample));
    fboA.setSize(newWidth, newHeight);
    fboB.setSize(newWidth, newHeight);
    pingPongMaterial.uniforms.uResolution.value.set(newWidth, newHeight);

    // Clear again to avoid reading undefined content during resize
    const prevColor = new THREE.Color();
    gl.getClearColor(prevColor);
    const prevAlpha = gl.getClearAlpha();
    gl.setClearColor(new THREE.Color(0, 0, 0), 1);
    [fboA, fboB].forEach((rt) => {
      gl.setRenderTarget(rt);
      gl.clear(true, true, true);
    });
    gl.setRenderTarget(null);
    gl.setClearColor(prevColor, prevAlpha as any);
  }, [gl, w, h, downsample, fboA, fboB, pingPongMaterial]);

  // Mouse events
  useEffect(() => {
    const handleMouseDown = () => setIsDrawing(true);
    const handleMouseUp = () => {
      setIsDrawing(false);
      if (controls.clearOnRelease) {
        const prevColor = new THREE.Color();
        gl.getClearColor(prevColor);
        const prevAlpha = gl.getClearAlpha();

        gl.setClearColor(new THREE.Color(0, 0, 0), 1);
        [fboA, fboB].forEach((rt) => {
          gl.setRenderTarget(rt);
          gl.clear(true, true, true);
        });
        gl.setRenderTarget(null);
        gl.setClearColor(prevColor, prevAlpha as any);

        // Reset to stable initial state: read 0, write 1
        readIndex.current = 0;
        writeIndex.current = 1;
      }
    };
    const handleMouseLeave = () => setIsDrawing(false);

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [gl, fboA, fboB, controls.clearOnRelease]);

  // External API
  const clearTraces = useCallback(() => {
    const prevColor = new THREE.Color();
    gl.getClearColor(prevColor);
    const prevAlpha = gl.getClearAlpha();

    gl.setClearColor(new THREE.Color(0, 0, 0), 1);
    [fboA, fboB].forEach((rt) => {
      gl.setRenderTarget(rt);
      gl.clear(true, true, true);
    });
    gl.setRenderTarget(null);
    gl.setClearColor(prevColor, prevAlpha as any);

    readIndex.current = 0;
    writeIndex.current = 1;
  }, [gl, fboA, fboB]);

  useImperativeHandle(ref, () => ({
    // Expose the "latest read buffer" (points to latest result after each frame swap)
    getFBOTexture: () => fbos[readIndex.current]?.texture ?? null,
    clearTraces,
  }));

  // Per-frame update: read from read buffer, write to write buffer → swap → debug shows read buffer (latest)
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const dt = Math.max(state.clock.getDelta(), 1e-6);

    // Convert to 0~1 UV coordinates
    const mousePos = new THREE.Vector2((pointer.x + 1) * 0.5, (pointer.y + 1) * 0.5);

    // Calculate mouse speed
    let curSpeed = 0;
    if (lastMousePos) curSpeed = mousePos.distanceTo(lastMousePos) / dt;
    setMouseSpeed(curSpeed);
    setLastMousePos(mousePos.clone());

    // Drawing conditions
    let shouldDraw = false;
    switch (controls.drawingMode) {
      case 'press': shouldDraw = isDrawing; break;
      case 'always': shouldDraw = true; break;
      case 'fast': shouldDraw = curSpeed > controls.speedThreshold; break;
    }

    // Update uniforms
    const u = pingPongMaterial.uniforms;
    u.uTime.value = t;
    u.uDeltaTime.value = dt;
    u.uMousePosition.value = mousePos;
    u.uIsDrawing.value = shouldDraw;

    (u.uDiffusion.value as number) = controls.diffusion;
    (u.uFadeSpeed.value as number) = controls.fadeSpeed;
    (u.uTraceColor.value as THREE.Color).set(controls.traceColor);
    (u.uTraceOpacity.value as number) = controls.traceOpacity;
    (u.uTraceSize.value as number) = controls.traceSize;
    (u.uMousePressure.value as number) = controls.pressure;
    (u.uCurl.value as number) = controls.curl;

    // Read from previous frame
    u.uPreviousTexture.value = fbos[readIndex.current].texture;

    // Write to current frame
    gl.setRenderTarget(fbos[writeIndex.current]);
    gl.render(simScene, simCamera);
    gl.setRenderTarget(null);

    // After rendering → swap buffers
    swap();

    // Debug always shows the swapped read buffer (= latest result)
    if (debugMatRef.current) {
      debugMatRef.current.uniforms.uTexture.value = fbos[readIndex.current].texture;
    }
  });

  return (
    <group>
      {controls.showDebug && (
        <mesh position={[0, 0, -1]}>
          <planeGeometry args={[2, 2]} />
          <shaderMaterial
            ref={debugMatRef}
            vertexShader={/* glsl */`
              varying vec2 vUv;
              void main() {
                vUv = uv;
                gl_Position = vec4(position, 1.0); // NDC quad
              }
            `}
            fragmentShader={/* glsl */`
              uniform sampler2D uTexture;
              uniform float uOpacity;
              varying vec2 vUv;
              void main() {
                vec4 color = texture2D(uTexture, vUv);
                gl_FragColor = vec4(color.rgb, color.a * uOpacity);
              }
            `}
            uniforms={{
              uTexture: { value: null }, // Updated by useFrame after swap to read buffer
              uOpacity: { value: 1 }
            }}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
});

MouseTraceFBO.displayName = 'MouseTraceFBO';
export default MouseTraceFBO;
