import { useEffect } from 'react';
import { MutableRefObject } from 'react';
import { CharacterState } from '../types';

export function useCharacterControls(state: MutableRefObject<CharacterState>) {
  // Keyboard input listener (only update ref, don't trigger re-render)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') state.current.isMoving = true;
      if (key === 'a') state.current.rotateLeft = true;
      if (key === 'd') state.current.rotateRight = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') state.current.isMoving = false;
      if (key === 'a') state.current.rotateLeft = false;
      if (key === 'd') state.current.rotateRight = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [state]);
}
