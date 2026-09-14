import type { Object3D, PerspectiveCamera, Vector3, WebGLRenderer } from "three";

export function webglAvailable(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function viewerHostClassName(): string {
  return "h-[min(28rem,70vh)] w-full touch-none overflow-hidden [:fullscreen_&]:h-[calc(100dvh-8rem)]";
}

type FitResult = {
  maxDim: number;
  cameraPosition: Vector3;
};

export function fitCameraToObject(
  THREE: typeof import("three"),
  object: Object3D,
  camera: PerspectiveCamera,
  target: Vector3,
): FitResult {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    throw new Error("empty-model");
  }

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fov = (camera.fov * Math.PI) / 180;
  const fitHeight = maxDim / (2 * Math.tan(fov / 2));
  const fitWidth = fitHeight / Math.max(camera.aspect, 0.0001);
  const distance = 1.4 * Math.max(fitHeight, fitWidth, maxDim);

  camera.near = Math.max(distance / 100, maxDim / 1000);
  camera.far = Math.max(distance * 24, maxDim * 40);
  const cameraPosition = new THREE.Vector3(distance * 0.85, distance * 0.55, distance * 0.85);
  camera.position.copy(cameraPosition);
  camera.updateProjectionMatrix();
  target.set(0, 0, 0);

  return { maxDim, cameraPosition };
}

export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as {
      geometry?: { dispose?: () => void };
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
    };
    mesh.geometry?.dispose?.();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material?.dispose?.();
    }
  });
}

export function disposeRenderer(renderer: WebGLRenderer, host: HTMLElement): void {
  renderer.dispose();
  renderer.forceContextLoss();
  if (renderer.domElement.parentElement === host) {
    host.removeChild(renderer.domElement);
  }
}

export function gridSizeForBounds(maxDim: number): number {
  return Math.max(maxDim * 2, 1);
}
