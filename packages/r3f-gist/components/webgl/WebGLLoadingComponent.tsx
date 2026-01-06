import React from 'react';

interface WebGLLoadingComponentProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function WebGLLoadingComponent({ className, style }: WebGLLoadingComponentProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
        color: '#ffffff',
        flexDirection: 'column',
        gap: '1rem',
        ...style
      }}
    >
      <div style={{ fontSize: '1.5rem', fontWeight: 'medium' }}>Loading WebGL Scene...</div>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #333',
        borderTop: '3px solid #fff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
    </div>
  );
}
