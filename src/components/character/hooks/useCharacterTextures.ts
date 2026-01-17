import { useTexture } from '@react-three/drei';
import * as THREE from 'three/webgpu';

export function useCharacterTextures() {
  // Load textures using useTexture hook
  const bodyTex = useTexture({
    map: 'textures/Body/Astronaut_Suit_Body_Albedo.png',
    metalnessMap: 'textures/Body/Astronaut_Suit_Body_Metallic.png',
    aoMap: 'textures/Body/Astronaut_Suit_Body_Ao.png',
    normalMap: 'textures/Body/Astronaut_Suit_Body_Normals.png'
  });
  bodyTex.map.colorSpace = THREE.SRGBColorSpace;

  const detailTex = useTexture({
    map: 'textures/Details/Astronaut_Suit_Details_Albedo.png',
    metalnessMap: 'textures/Details/Astronaut_Suit_Details_Metallic.png',
    aoMap: 'textures/Details/Astronaut_Suit_Details_Ao.png',
    normalMap: 'textures/Details/Astronaut_Suit_Details_Normals.png'
  });
  detailTex.map.colorSpace = THREE.SRGBColorSpace;

  return { bodyTex, detailTex };
}
