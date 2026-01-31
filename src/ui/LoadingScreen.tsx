import { useProgress } from "@react-three/drei";
import { useEffect, useRef, useState, useMemo } from "react";
import { useGameStore } from "../core/store/gameStore";
import gsap from "gsap";

// --- Constants & Config ---
const EXPECTED_COMPONENTS = ['grass', 'rose', 'character'];
const FADE_OUT_DURATION = 1;

// --- Sub-Components (Icons & UI Elements) ---

const Key = ({ children }: { children: React.ReactNode }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        minWidth: '18px', height: '22px', padding: '0 5px', margin: '0 4px',
        border: '1px solid #555', borderRadius: '4px', background: 'rgba(255,255,255,0.05)',
        fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: '#ccc',
        lineHeight: 1, verticalAlign: 'middle', boxSizing: 'border-box'
    }}>
        {children}
    </span>
);

const MouseIcon = () => (
    <span style={{
        display: 'inline-block', position: 'relative', width: '12px', height: '18px', margin: '0 4px',
        border: '1.5px solid #ccc', borderRadius: '6px', verticalAlign: 'middle', opacity: 0.8
    }}>
        <span style={{
            position: 'absolute', top: '3px', left: '50%', transform: 'translateX(-50%)',
            width: '1.5px', height: '4px', background: '#ccc', borderRadius: '1px'
        }} />
    </span>
);

const InstructionRow = ({ input, label }: { input: React.ReactNode, label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
        {input}
        <span style={{ marginLeft: '6px', fontSize: '10px', letterSpacing: '1px', fontWeight: 500, transform: 'translateY(1px)' }}>
            {label}
        </span>
    </div>
);

// --- Main Component ---

export function LoadingScreen() {
    // Store & Hooks
    const { active, progress: downloadProgress } = useProgress();
    const componentsReady = useGameStore((state) => state.componentsReady) as Record<string, boolean>;
    const isMobile = useGameStore((state) => state.isMobile);
    const setIsGameStarted = useGameStore((state) => state.setIsGameStarted);

    // Local State
    const [isReadyToStart, setIsReadyToStart] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    // --- Logic: Calculate Progress ---
    // Combined progress: 50% for download, 50% for shader compilation/component readiness
    const displayProgress = useMemo(() => {
        const readyCount = EXPECTED_COMPONENTS.filter(id => !!componentsReady[id]).length;
        const totalExpected = EXPECTED_COMPONENTS.length;
        const compileProgress = (readyCount / totalExpected) * 100.0;

        let total = 0;
        if (active) {
            total = downloadProgress * 0.5;
        } else {
            total = 50 + (compileProgress * 0.5);
        }
        return Math.min(Math.round(total), 99);
    }, [active, downloadProgress, componentsReady]);

    // --- Logic: Check Readiness ---
    useEffect(() => {
        const readyCount = EXPECTED_COMPONENTS.filter(id => !!componentsReady[id]).length;
        if (readyCount >= EXPECTED_COMPONENTS.length && !active) {
            // Small delay to ensure smooth transition
            const t = setTimeout(() => setIsReadyToStart(true), 200);
            return () => clearTimeout(t);
        }
    }, [componentsReady, active]);

    // --- Handlers ---
    const handleStart = () => {
        if (!isReadyToStart) return;
        
        setIsGameStarted(true);

        // Animate out
        if (containerRef.current) {
            gsap.to(containerRef.current, {
                opacity: 0,
                duration: FADE_OUT_DURATION,
                ease: "power2.inOut",
                onComplete: () => setIsVisible(false)
            });
        }
    };

    if (!isVisible) return null;

    // --- Styles ---
    const containerStyle: React.CSSProperties = {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: '#000', zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'Cousine',
        pointerEvents: 'auto', // Blocks clicks to 3D scene
        fontSize: isMobile ? '0.7rem' : '0.9rem',
        opacity: 0.99, // Prevent culling
    };

    const playButtonStyle: React.CSSProperties = {
        color: 'white', backgroundColor: 'transparent', border: 'none',
        letterSpacing: '3px', transition: 'all 0.5s ease',
        cursor: isReadyToStart ? 'pointer' : 'wait',
        transform: 'scale(1)', // Initial state for transform
    };

    return (
        <div ref={containerRef} style={containerStyle}>
            <div className='entry' style={{
                opacity: 1, textAlign: 'center', maxWidth: isMobile ? '90%' : '600px',
                padding: '20px', animation: 'fadeIn 2s ease'
            }}>
                
                {/* Title */}
                <div style={{
                    fontSize: '1rem', fontWeight: 'bold',
                    letterSpacing: isMobile ? '0.3rem' : '0.5rem', marginBottom: '2rem',
                }}>
                    FALSE EARTH
                </div>

                {/* Intro Text */}
                <div style={{ lineHeight: '1.5', color: '#ccc', marginBottom: '3rem', textAlign: 'left' }}>
                    <p>After a long period of drifting, solid ground appears on a planet that closely resembles Earth.</p>
                    <p>As movement continues across an endless field, the horizon remains fixed, and flowers appear where light from the sky reaches the ground.</p>
                    <p>Travel through the open terrain, influence the falling light through your movement, and witness a quiet phenomenon unfolding across the surface.</p>
                </div>

                {/* Play Button & Progress Bar */}
                <div className='play'>
                    <button
                        onClick={handleStart}
                        disabled={!isReadyToStart}
                        style={playButtonStyle}
                        onMouseEnter={(e) => isReadyToStart && (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseLeave={(e) => isReadyToStart && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {isReadyToStart ? "START" : (
                            <span>
                                {active ? "ESTABLISHING UPLINK" : "CALIBRATING SENSORS"}... {displayProgress}%
                            </span>
                        )}
                    </button>

                    <div style={{ 
                        width: '250px', height: '1px', background: '#222', margin: '10px auto', 
                        opacity: isReadyToStart ? 0 : 1, transition: 'opacity 0.5s' 
                    }}>
                        <div style={{ width: `${displayProgress}%`, height: '100%', background: '#666', transition: 'width 0.2s' }} />
                    </div>
                </div>

                {/* Controls Instructions */}
                <div style={{
                    marginTop: '80px', color: '#ccc', opacity: 0.8, animation: 'fadeIn 3s ease',
                    userSelect: 'none', display: 'flex', justifyContent: 'center', gap: '24px',
                    flexDirection: isMobile ? 'column' : 'row',
                }}>
                    {isMobile ? (
                        <>
                            <InstructionRow input={<Key>ONE FINGER</Key>} label="MOVE" />
                            <InstructionRow input={<Key>TWO FINGERS</Key>} label="LOOK" />
                        </>
                    ) : (
                        <>
                            <InstructionRow input={<><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key></>} label="MOVE" />
                            <InstructionRow input={<Key>SHIFT</Key>} label="BOOST" />
                            <InstructionRow input={<Key>C</Key>} label="CAMERA" />
                            <InstructionRow input={<MouseIcon />} label="LOOK" />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}