'use client';

import React, { ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useWebGLDetection } from './hooks/useWebGLDetection';
import { WebGLErrorBoundary } from './WebGLErrorBoundary';
import { WebGLLoadingSpinner } from './WebGLLoadingSpinner';

interface WebGLCanvasProps {
    children: ReactNode;
    gl?: any;
    frameloop?: 'always' | 'demand' | 'never';
    shadows?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onCreated?: (state: any) => void;
    onError?: (error: any) => void;
    fallback?: ReactNode;
    loadingComponent?: ReactNode;
    errorComponent?: ReactNode;
    forceLoading?: boolean;
    forceError?: boolean;
}

export default function WebGLCanvas({
    children,
    gl = {},
    frameloop = 'always',
    shadows = false,
    className,
    style,
    onCreated,
    onError,
    fallback,
    loadingComponent,
    errorComponent,
    forceLoading = false,
    forceError = false,
    ...props
}: WebGLCanvasProps) {
    const webglAvailable = useWebGLDetection();

    // Loading state
    if (webglAvailable === null || forceLoading) {
        return loadingComponent ? <>{loadingComponent}</> : (
            <WebGLLoadingSpinner className={className} style={style} />
        );
    }

    // Error state
    if (!webglAvailable || forceError) {
        if (fallback) return <>{fallback}</>;
        if (errorComponent) return <>{errorComponent}</>;

        return (
            <div className={className} style={{ 
                ...style, 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000000',
                color: '#ffffff',
                flexDirection: 'column',
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <div>WebGL is not available</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    This experience requires WebGL support. Please enable WebGL in your browser settings or try a different browser.
                </div>
            </div>
        );
    }

    // Canvas configuration
    const canvasConfig = {
        shadows,
        gl: {
            shadowMapType: THREE.PCFSoftShadowMap,
            antialias: true,
            alpha: false,
            powerPreference: "high-performance" as const,
            failIfMajorPerformanceCaveat: false,
            preserveDrawingBuffer: false,
            stencil: false,
            depth: true,
            ...gl
        },
        frameloop,
        className,
        style,
        onCreated: (state: any) => {
            if (state.gl) {
                state.gl.setClearColor('#000000');
            }

            // Suppress WebGL warnings
            const originalError = console.error;
            console.error = function (...args) {
                if (args[0] && typeof args[0] === 'string' && args[0].includes('WebGL')) {
                    return;
                }
                originalError.apply(console, args);
            };

            onCreated?.(state);
        },
        onError: (error: any) => {
            console.warn('Canvas error handled:', error);
            onError?.(error);
        },
        ...props
    };

    return (
        <WebGLErrorBoundary fallback={fallback} errorComponent={errorComponent} onError={onError}>
            <Canvas {...canvasConfig}>
                {children}
            </Canvas>
        </WebGLErrorBoundary>
    );
}
