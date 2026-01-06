import React, { useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useControls } from 'leva';

interface AdaptiveDPRMonitorProps {
    onDPRChange?: (dpr: number) => void;
    initialDPR?: number;
}

export const AdaptiveDPRMonitor: React.FC<AdaptiveDPRMonitorProps> = ({
    onDPRChange = () => { },
    initialDPR
}) => {
    const { gl } = useThree();

    // Performance monitoring refs
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(performance.now());
    const lastDPRChangeRef = useRef(0);
    const consecutiveLowFPSRef = useRef(0);
    const consecutiveHighFPSRef = useRef(0);
    const dprRef = useRef(initialDPR ?? gl.getPixelRatio());

    // Adaptive DPR controls
    const perfControls = useControls('Performance', {
        enableAdaptiveDRP: { value: true, label: 'Enable Adaptive DPR' },
        targetFPS: { value: 30, min: 30, max: 60, step: 5, label: 'Target FPS' },
        minDPR: { value: 1, min: 0.25, max: 1, step: 0.25, label: 'Min DPR' },
        maxDPR: { value: 2, min: 1, max: 3, step: 0.25, label: 'Max DPR' }
    }, { collapsed: true });

    // Adaptive DPR adjustment logic
    const adjustDPR = useCallback((fps: number, currentTime: number) => {
        const timeSinceLastChange = currentTime - lastDPRChangeRef.current;

        if (timeSinceLastChange < 3000) return; // Cooldown period


        if (fps < perfControls.targetFPS - 5) {
            // Performance is poor, reduce DPR
            consecutiveLowFPSRef.current++;
            consecutiveHighFPSRef.current = 0;

            if (consecutiveLowFPSRef.current >= 1 && dprRef.current > perfControls.minDPR) {
                const newDPR = Math.max(perfControls.minDPR, dprRef.current - 0.25);
                dprRef.current = newDPR;
                gl.setPixelRatio(newDPR);
                onDPRChange(newDPR);
                lastDPRChangeRef.current = currentTime;
            }
        } else if (fps > perfControls.targetFPS + 15) {
            // Performance is good, increase DPR
            consecutiveHighFPSRef.current++;
            consecutiveLowFPSRef.current = 0;

            if (consecutiveHighFPSRef.current >= 2 && dprRef.current < perfControls.maxDPR) {
                const newDPR = Math.min(perfControls.maxDPR, dprRef.current + 0.25);
                dprRef.current = newDPR;
                gl.setPixelRatio(newDPR);
                onDPRChange(newDPR);
                lastDPRChangeRef.current = currentTime;
            }
        } else {
            // FPS is in acceptable range, reset counters
            consecutiveLowFPSRef.current = 0;
            consecutiveHighFPSRef.current = 0;
        }
    }, [perfControls.targetFPS, perfControls.minDPR, perfControls.maxDPR, onDPRChange, gl]);

    // Initialize DPR on mount
    useEffect(() => {
        const currentDPR = initialDPR ?? gl.getPixelRatio();
        dprRef.current = currentDPR;
        gl.setPixelRatio(currentDPR);
        onDPRChange(currentDPR);
    }, [initialDPR]);

    useFrame(() => {
        if (!perfControls.enableAdaptiveDRP) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        frameCountRef.current++;

        if (deltaTime >= 2000) {
            const fps = (frameCountRef.current * 1000) / deltaTime;
            adjustDPR(fps, currentTime);

            frameCountRef.current = 0;
            lastTimeRef.current = currentTime;
        }
    });

    return null;
};
