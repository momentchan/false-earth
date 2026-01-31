import { useEffect } from 'react';
import { inputState } from './InputManager';

export function useKeyboard() {
    useEffect(() => {
        const handleKey = (e: KeyboardEvent, isDown: boolean) => {
            const key = e.key.toLowerCase();
            const code = e.code;

            switch (key) {
                case 'w':
                case 'arrowup':
                    inputState.moveForward = isDown;
                    break;
                case 'a':
                case 'arrowleft':
                    inputState.rotateLeft = isDown;
                    break;
                case 'd':
                case 'arrowright':
                    inputState.rotateRight = isDown;
                    break;
                case 's':
                case 'arrowdown':
                    inputState.moveBackward = isDown;
                    break;
            }

            if (code === 'ShiftLeft' || code === 'ShiftRight') {
                inputState.run = isDown;
            }
        };

        const onDown = (e: KeyboardEvent) => handleKey(e, true);
        const onUp = (e: KeyboardEvent) => handleKey(e, false);

        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);

        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
        };
    }, []);
}