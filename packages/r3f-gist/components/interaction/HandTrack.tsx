import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Optional handtrackjs dependency
let handTrack: any = null;
let isHandTrackAvailable = false;

// Try to load handtrackjs
try {
    handTrack = require('handtrackjs');
    isHandTrackAvailable = true;
} catch (error) {
    // Expected when handtrackjs is not installed
    isHandTrackAvailable = false;
    handTrack = null;
}

let model: any = null;

const modelParams = {
    flipHorizontal: true, // flip e.g for video
    maxNumBoxes: 20, // maximum number of boxes to detect
    iouThreshold: 0.5, // ioU threshold for non-max suppression
    scoreThreshold: 0.6, // confidence threshold for predictions.
};

interface HandTrackProps {
    onPrediction?: (predictions: any[]) => void;
    enabled?: boolean;
}

export interface HandTrackRef {
    getPredictions(): any;
    showCanvas(show: boolean): void;
    toggleCanvas(): void;
    isSupported(): boolean;
}

export default forwardRef<HandTrackRef, HandTrackProps>(function HandTrack(props, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isVideo, setIsVideo] = useState(false);
    const [showCanvas, setShowCanvas] = useState(true);
    const [predictions, setPredictions] = useState<any>();
    const [isSupported, setIsSupported] = useState(isHandTrackAvailable);

    useImperativeHandle(ref, () => ({
        getPredictions() {
            return predictions;
        },

        showCanvas(show: boolean) {
            setShowCanvas(show);
        },

        toggleCanvas() {
            setShowCanvas(!showCanvas);
        },

        isSupported() {
            return isSupported;
        }
    }));

    useEffect(() => {
        if (!isHandTrackAvailable || !handTrack) {
            setIsSupported(false);
            return;
        }

        handTrack.load(modelParams).then((lmodel: any) => {
            console.log('Model loaded.');
            model = lmodel;
            startVideo();
        }).catch((error: any) => {
            console.error('Failed to load hand tracking model:', error);
            setIsSupported(false);
        });

        function startVideo() {
            if (!handTrack) return;

            handTrack.startVideo(videoRef.current).then(function (status: boolean) {
                console.log("video started", status);
                if (status) {
                    console.log("Video started. Now tracking");
                    setIsVideo(true);
                    runDetection();
                } else {
                    console.log("Please enable video");
                }
            }).catch((error: any) => {
                console.error('Failed to start video:', error);
                setIsSupported(false);
            });
        }

        function runDetection() {
            if (!model || !handTrack) return;

            model.detect(videoRef.current).then((predictions: any) => {
                setPredictions(predictions);

                if (showCanvas && canvasRef.current && model) {
                    model.renderPredictions(predictions, canvasRef.current, canvasRef.current.getContext("2d"), videoRef.current);
                }
                if (isSupported) {
                    requestAnimationFrame(runDetection);
                }
            }).catch((error: any) => {
                console.error('Detection error:', error);
                setIsSupported(false);
            });
        }

        return () => {
            // Cleanup if needed
        };
    }, [showCanvas, isSupported]);

    return <>
        {isSupported ? (
            <>
                <video ref={videoRef} autoPlay id="myvideo" style={{ display: 'none' }} />
                {showCanvas && <canvas ref={canvasRef} id="canvas" style={{
                    position: 'fixed',
                    bottom: 0,
                    right: 0,
                    width: "320px",
                    height: "240px",
                    zIndex: 100,
                }} />}
            </>
        ) : (
            <div style={{
                position: 'fixed',
                bottom: 10,
                right: 10,
                padding: '8px',
                background: '#ff4444',
                color: '#fff',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
            }}>
                HandTrack: handtrackjs not available
            </div>
        )}
    </>
});