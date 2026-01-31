import { IconButton, Tooltip } from '@mui/material';
import { CameraMode, useGameStore } from '../core/store/gameStore';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

export function SideBar() {
    const isMobile = useGameStore((state) => state.isMobile);
    
    const cameraMode = useGameStore((state) => state.cameraMode);
    const setCameraMode = useGameStore((state) => state.setCameraMode);

    const quality = useGameStore((state) => state.quality); 
    const toggleQuality = useGameStore((state) => state.toggleQuality); 

    const cycleCameraMode = () => {
        setCameraMode((cameraMode + 1) % 3);
    };

    const btnStyle = {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        backdropFilter: 'blur(4px)',
        borderRadius: '8px',
        padding: isMobile ? '8px' : '10px',
        border: '1px solid rgba(255,255,255,0.1)',
        transition: 'all 0.2s ease',
        color: 'white',

        '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            borderColor: 'rgba(255,255,255,0.3)',
        },
    } as const;

    const iconBaseStyle = {
        fontSize: isMobile ? '20px' : '24px',
    };

    const qualityIconStyle = {
        ...iconBaseStyle,
        transition: 'color 0.3s ease, filter 0.3s ease',
        color: quality === 'high' ? '#4fc3f7' : 'rgba(255, 255, 255, 0.5)', 
        filter: quality === 'high' ? 'drop-shadow(0 0 5px rgba(0, 255, 255, 0.5))' : 'none',
    };


    const cameraConfig = {
        [CameraMode.TPV]: {
            icon: <PersonIcon sx={iconBaseStyle} />,
            title: "Third Person"
        },
        [CameraMode.FPV]: {
            icon: <VisibilityIcon sx={iconBaseStyle} />,
            title: "First Person"
        },
        [CameraMode.FREE]: {
            icon: <OpenWithIcon sx={iconBaseStyle} />,
            title: "Free Cam"
        },
    };
    const currentCamera = cameraConfig[cameraMode];

    const qualityTooltip = quality === 'high' ? 'Quality' : 'Performance';


    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            pointerEvents: 'auto',
            zIndex: 50,
        }}>
            
            <Tooltip title={currentCamera.title} placement="left">
                <IconButton sx={btnStyle} onClick={cycleCameraMode}>
                    {currentCamera.icon}
                </IconButton>
            </Tooltip>

            <Tooltip title={ qualityTooltip } placement="left">
                <IconButton sx={btnStyle} onClick={toggleQuality}>
                    <AutoAwesomeIcon sx={qualityIconStyle} />
                </IconButton>
            </Tooltip>

        </div>
    );
}