import { fileExtension } from "@/lib/config/uploads";
import type { Object3D } from "three";

const SUPPORTED = new Set(["glb", "gltf", "stl", "obj", "3mf"]);

export function isSupportedMeshFilename(filename: string): boolean {
  return SUPPORTED.has(fileExtension(filename));
}

/**
 * Parse a mesh buffer with Three.js loaders. Visualization only — no scripts,
 * no Draco pipeline, no Blender files. glTF with external .bin/.png sidecars
 * will fail; prefer a self-contained GLB.
 */
export async function loadMeshObject(buffer: ArrayBuffer, filename: string): Promise<Object3D> {
  const extension = fileExtension(filename);
  if (!SUPPORTED.has(extension)) {
    throw new Error("unsupported-format");
  }

  const THREE = await import("three");
  const engineering = new THREE.MeshStandardMaterial({
    color: 0x1f4e79,
    metalness: 0.12,
    roughness: 0.55,
  });

  if (extension === "stl") {
    const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
    const geometry = new STLLoader().parse(buffer);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, engineering);
  }

  if (extension === "obj") {
    const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
    const text = new TextDecoder().decode(buffer);
    const group = new OBJLoader().parse(text);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        child.material = engineering;
      }
    });
    return group;
  }

  if (extension === "3mf") {
    const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
    return new ThreeMFLoader().parse(buffer);
  }

  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const loader = new GLTFLoader();
  const source: ArrayBuffer | string =
    extension === "gltf" ? new TextDecoder().decode(buffer) : buffer;

  return new Promise((resolve, reject) => {
    loader.parse(
      source,
      "",
      (gltf) => resolve(gltf.scene),
      () => reject(new Error("invalid-model")),
    );
  });
}
