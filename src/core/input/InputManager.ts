// define input state interface
export interface InputState {
    moveForward: boolean;
    rotateLeft: boolean;
    rotateRight: boolean;
    moveBackward: boolean;
    run: boolean;
}


// singleton object
export const inputState: InputState = {
    moveForward: false,
    rotateLeft: false,
    rotateRight: false,
    moveBackward: false,
    run: false,
};

// reset input
export const resetInput = () => {
    inputState.moveForward = false;
    inputState.rotateLeft = false;
    inputState.rotateRight = false;
    inputState.moveBackward = false;
    inputState.run = false;
};