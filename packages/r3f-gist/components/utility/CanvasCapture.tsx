import { useEffect } from "react";

interface CanvasCaptureProps {
    /** Enable screenshot functionality with 's' key */
    enableScreenshot?: boolean;
    /** Custom screenshot filename */
    screenshotName?: string;
}

/**
 * CanvasCapture - Utility component for canvas screenshot functionality
 * Press 's' key to capture canvas as PNG
 */
export default function CanvasCapture({ 
    enableScreenshot = true,
    screenshotName = 'Screenshot.png'
}: CanvasCaptureProps) {

    useEffect(() => {
        if (!enableScreenshot) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 's' || event.key === 'S') {
                event.preventDefault();
                takeScreenshot(screenshotName);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [enableScreenshot, screenshotName]);

    return null; // This component doesn't render anything
}

/**
 * Take a screenshot of the first canvas element found in the document
 */
export function takeScreenshot(filename: string = 'Screenshot.png'): void {
    const canvas = document.querySelector('canvas');
    
    if (!canvas) {
        console.warn('CanvasCapture: No canvas element found');
        return;
    }

    try {
        const link = document.createElement('a');
        link.setAttribute('download', filename);
        link.setAttribute('href', canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream'));
        link.click();
        
        console.log(`Screenshot saved as: ${filename}`);
    } catch (error) {
        console.error('Failed to take screenshot:', error);
    }
}

/**
 * Take a screenshot of a specific canvas element
 */
export function takeCanvasScreenshot(canvas: HTMLCanvasElement, filename: string = 'Screenshot.png'): void {
    try {
        const link = document.createElement('a');
        link.setAttribute('download', filename);
        link.setAttribute('href', canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream'));
        link.click();
        
        console.log(`Screenshot saved as: ${filename}`);
    } catch (error) {
        console.error('Failed to take screenshot:', error);
    }
}

// Legacy export for backward compatibility
export { takeScreenshot as Screenshot };