import { useGameStore } from "../core/store/gameStore";
import { LoadingScreen } from "./LoadingScreen";
import AudioButton from "./AudioButton";
import { SideBar } from "./SideBar";
import { TouchControls } from "../core/input/TouchControls";

export function UI() {
    const isMobile = useGameStore((state) => state.isMobile);

    return (
        <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            pointerEvents: 'none', // Critical: lets clicks pass through to the 3D canvas
            zIndex: 10 // Ensure UI is above Canvas
        }}>
            <LoadingScreen />
            <AudioButton />
            <SideBar />
            {isMobile && <TouchControls />}
        </div>
    );
}