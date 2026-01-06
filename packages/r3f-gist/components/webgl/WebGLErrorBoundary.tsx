import React, { Component, ReactNode } from 'react';

interface WebGLErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
    errorComponent?: ReactNode;
    onError?: (error: Error, errorInfo: any) => void;
}

interface WebGLErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
    constructor(props: WebGLErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.warn('WebGL Error caught by boundary:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return <>{this.props.fallback}</>;
            }

            if (this.props.errorComponent) {
                return <>{this.props.errorComponent}</>;
            }

            return (
                <div style={{
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
                    <div>WebGL Error</div>
                    <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                        {this.state.error?.message || 'An error occurred while rendering the 3D scene.'}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
