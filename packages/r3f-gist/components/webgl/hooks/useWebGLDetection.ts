import { useState, useEffect } from 'react';

// WebGL detection utility
const isWebGLAvailable = (): boolean => {
    if (typeof window === 'undefined') return false;

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    } catch {
        return false;
    }
};

export const useWebGLDetection = () => {
    const [webglAvailable, setWebglAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        setWebglAvailable(isWebGLAvailable());
    }, []);

    return webglAvailable;
};
