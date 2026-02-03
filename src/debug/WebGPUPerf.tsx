import { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

export function WebGpuPerf() {
    const { gl } = useThree();
    const [display, setDisplay] = useState({ calls: 0, tris: 0 });

    const lastTime = useRef(performance.now());
    const frameCount = useRef(0);

    useEffect(() => {
        const originalRender = gl.render.bind(gl);
        gl.render = (scene, camera) => {
            originalRender(scene, camera);

            frameCount.current++;
            const time = performance.now();

            if (time - lastTime.current >= 500) {
                const info = gl.info;
                // @ts-ignore
                const calls =  info.render.drawCalls;
                
                setDisplay({
                    calls: calls,
                    tris: info.render.triangles || 0
                });

                lastTime.current = time;
                frameCount.current = 0;
            }
        };

        // 3. Cleanup
        return () => { 
            gl.render = originalRender; 
        };
    }, [gl]);

    return (
        <Html fullscreen pointerEvents="none" style={{ transform: 'none' }}>
            <div style={{
                position: 'absolute', top: 10, left: 10,
                background: 'rgba(0,0,0,0.85)', color: '#0f0', padding: '10px',
                fontFamily: 'monospace', border: '1px solid #444', 
                minWidth: '130px', fontWeight: 'bold'
            }}>
                <div style={{ color: display.calls > 1000 ? '#ff5555' : '#0f0' }}>
                   Drawcalls : {display.calls} {display.calls > 1000 && '⚠️'}
                </div>
                <div>Tris  : {(display.tris/1000).toFixed(1)}k</div>
            </div>
        </Html>
    );
}