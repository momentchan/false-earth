export interface TerrainParams {
  amplitude: number
  frequency: number
  seed: number
  color: string
}

export interface GrassProps {
  terrainParams?: TerrainParams
  patchSize?: number
  onPatchSizeChange?: (patchSize: number) => void
}

