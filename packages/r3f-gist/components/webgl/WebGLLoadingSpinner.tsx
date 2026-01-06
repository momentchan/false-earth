import React from 'react';

interface WebGLLoadingSpinnerProps {
    className?: string;
    style?: React.CSSProperties;
    message?: string;
}

const loadingStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    color: '#ffffff'
};

export const WebGLLoadingSpinner: React.FC<WebGLLoadingSpinnerProps> = ({ 
    className, 
    style, 
    message = 'Loading...' 
}) => {
    return (
        <div className={className} style={{ ...style, ...loadingStyles }}>
            <div>{message}</div>
        </div>
    );
};
