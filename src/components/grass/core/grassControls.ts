import { folder } from 'leva'
import { TIP_COLOR_PRESETS } from './config'

export function createGrassControls() {
  return {
    Geometry: folder({
      Shape: folder({
        bladeHeightMin: { value: 0.4, min: 0.1, max: 2.0, step: 0.01 },
        bladeHeightMax: { value: 0.8, min: 0.1, max: 2.0, step: 0.01 },
        bladeWidthMin: { value: 0.01, min: 0.01, max: 0.2, step: 0.001 },
        bladeWidthMax: { value: 0.05, min: 0.01, max: 0.2, step: 0.001 },
        bendAmountMin: { value: 0.2, min: 0.0, max: 1.0, step: 0.01 },
        bendAmountMax: { value: 0.6, min: 0.0, max: 1.0, step: 0.01 },
        bladeRandomness: { value: { x: 0.3, y: 0.3, z: 0.2 }, step: 0.01, min: 0.0, max: 1.0 },
        baseWidth: { value: 0.35, min: 0.0, max: 1.0, step: 0.01 },
        tipThin: { value: 0.9, min: 0.0, max: 2.0, step: 0.01 },
        thicknessStrength: { value: 0.10, min: 0.0, max: 0.2, step: 0.001 },
      }, { collapsed: true }),
      Clump: folder({
        clumpSize: { value: 1.5, min: 0.1, max: 5.0, step: 0.1 },
        clumpBlendSmoothness: { value: 1, min: 0.0, max: 1.0, step: 0.01 },
      }, { collapsed: true }),
      Angle: folder({
        centerYaw: { value: 0.1, min: 0.0, max: 0.5, step: 0.01 },
        bladeYaw: { value: 1.2, min: 0.0, max: 3.0, step: 0.1 },
        clumpYaw: { value: 2.7, min: 0.0, max: 5.0, step: 0.1 },
      }, { collapsed: true }),
    }, { collapsed: true }),

    Appearance: folder({
      Color: folder({
        tipColor: { value: TIP_COLOR_PRESETS[0] },
        baseColor: { value: '#000000' },
        bladeSeedRange: { value: { x: 0.95, y: 1.03 }, step: 0.01, min: 0.5, max: 1.5 },
        clumpSeedRange: { value: { x: 0.9, y: 1.1 }, step: 0.01, min: 0.5, max: 1.5 },
        aoPower: { value: 5, min: 0.1, max: 20.0, step: 0.1 },
      }, { collapsed: true }),
      Normal: folder({
        midSoft: { value: 0.25, min: 0.0, max: 1.0, step: 0.01 },
        rimPos: { value: 0.42, min: 0.0, max: 1.0, step: 0.01 },
        rimSoft: { value: 0.03, min: 0.0, max: 0.1, step: 0.001 },
      }, { collapsed: true }),
    }, { collapsed: true }),

    Animation: folder({
      Wind: folder({
        windDirX: { value: 1, min: -1, max: 1, step: 0.01 },
        windDirZ: { value: 0, min: -1, max: 1, step: 0.01 },
        windSpeed: { value: 0.35, min: 0, max: 3, step: 0.01 },
        windStrength: { value: 4.5, min: 0, max: 10, step: 0.01 },
        windScale: { value: 0.1, min: 0.01, max: 1, step: 0.01 },
        windFacing: { value: 1, min: 0.0, max: 1.0, step: 0.01 },
        swayFreqMin: { value: 0.4, min: 0.1, max: 10.0, step: 0.1 },
        swayFreqMax: { value: 1.5, min: 0.1, max: 10.0, step: 0.1 },
        swayStrength: { value: 0.01, min: 0.0, max: 0.05, step: 0.001 },
        windDistanceStart: { value: 50, min: 0, max: 100, step: 1 },
        windDistanceEnd: { value: 100, min: 0, max: 200, step: 1 },
      }, { collapsed: true }),
      Interaction: folder({
        pushRadius: { value: 0.7, min: 0.1, max: 2.0, step: 0.01 },
        pushAmount: { value: 0.4, min: 0.0, max: 1.0, step: 0.01 },
        flattenAmount: { value: 0.05, min: 0.0, max: 1.0, step: 0.01 },
      }, { collapsed: true }),
    }, { collapsed: true }),

    Performance: folder({
        lodNoiseScale: { value: 0.1, min: 0.0, max: 0.5, step: 0.01 },
        cullOffset: { value: 2, min: 0.1, max: 5.0, step: 0.01 },
    }, { collapsed: true }),

    Material: folder({
      roughness: { value: 0.35, min: 0.0, max: 1.0, step: 0.01 },
      metalness: { value: 0.5, min: 0.0, max: 1.0, step: 0.01 },
      emissive: { value: '#61ffef' },
      envMapIntensity: { value: 0.5, min: 0.0, max: 3.0, step: 0.1 },
    }, { collapsed: true }),
  }
}

