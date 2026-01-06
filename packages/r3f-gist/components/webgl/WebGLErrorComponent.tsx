import React from 'react';

interface WebGLErrorComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function WebGLErrorComponent({ className, style }: WebGLErrorComponentProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        color: '#ffffff',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '2rem',
        textAlign: 'center',
        ...style
      }}
    >
      <div style={{ fontSize: '2rem' }}>⚠️</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'medium' }}>WebGL Error</div>
      <div style={{ fontSize: '1rem', opacity: 0.8, maxWidth: '500px' }}>
        This experience requires WebGL support. Please enable WebGL in your browser settings or try a different browser.
      </div>
    </div>
  );
}
