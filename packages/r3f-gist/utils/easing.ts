/*
 * This work is free. You can redistribute it and/or modify it under the
 * terms of the Do What The Fuck You Want To Public License, Version 2,
 * as published by Sam Hocevar. See the COPYING file for more details.
 */

/**
 * Easing Functions - inspired from http://gizma.com/easing/
 * Only considering the t value for the range [0, 1] => [0, 1]
 */
export const EasingFunctions = {
    // no easing, no acceleration
    linear: (t: number): number => t,
    // accelerating from zero velocity
    easeInQuad: (t: number): number => t*t,
    // decelerating to zero velocity
    easeOutQuad: (t: number): number => t*(2-t),
    // acceleration until halfway, then deceleration
    easeInOutQuad: (t: number): number => t<.5 ? 2*t*t : -1+(4-2*t)*t,
    // accelerating from zero velocity 
    easeInCubic: (t: number): number => t*t*t,
    // decelerating to zero velocity 
    easeOutCubic: (t: number): number => (--t)*t*t+1,
    // acceleration until halfway, then deceleration 
    easeInOutCubic: (t: number): number => t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1,
    // accelerating from zero velocity 
    easeInQuart: (t: number): number => t*t*t*t,
    // decelerating to zero velocity 
    easeOutQuart: (t: number): number => 1-(--t)*t*t*t,
    // acceleration until halfway, then deceleration
    easeInOutQuart: (t: number): number => t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t,
    // accelerating from zero velocity
    easeInQuint: (t: number): number => t*t*t*t*t,
    // decelerating to zero velocity
    easeOutQuint: (t: number): number => 1+(--t)*t*t*t*t,
    // acceleration until halfway, then deceleration 
    easeInOutQuint: (t: number): number => t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t
} as const;