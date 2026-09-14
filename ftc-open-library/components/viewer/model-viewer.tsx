"use client";

import { useEffect, useRef, useState } from "react";
import { fetchPreviewBytes } from "@/lib/previews/client";
import { ModelControls } from "@/components/viewer/model-controls";
import { loadMeshObject } from "@/components/viewer/model-loader";
import {
  disposeObject,
  disposeRenderer,
  fitCameraToObject,
  gridSizeForBounds,
  viewerHostClassName,
  webglAvailable,
} from "@/components/viewer/viewer-utils";

type ModelViewerProps = {
  fileId: string;
  filename: string;
};

type ViewerStatus = "loading" | "ready" | "error";

export function ModelViewer({ fileId, filename }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const setGridRef = useRef<((visible: boolean) => void) | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [message, setMessage] = useState("Loading 3D preview…");
  const [gridVisible, setGridVisible] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;
    let dispose: (() => void) | undefined;

    async function start(target: HTMLDivElement) {
      setStatus("loading");
      setMessage("Loading 3D preview…");
      setGridVisible(false);

      if (!webglAvailable()) {
        setStatus("error");
        setMessage("3D preview is not available in this browser.");
        return;
      }

      const result = await fetchPreviewBytes(fileId);
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }

      try {
        const session = await createViewer(target, result.buffer, filename);
        if (cancelled) {
          session.dispose();
          return;
        }
        dispose = session.dispose;
        resetRef.current = session.reset;
        setGridRef.current = session.setGridVisible;
        setStatus("ready");
        setMessage("");
      } catch {
        setStatus("error");
        setMessage("This file could not be shown in the 3D viewer.");
      }
    }

    void start(host);

    return () => {
      cancelled = true;
      resetRef.current = null;
      setGridRef.current = null;
      dispose?.();
    };
  }, [fileId, filename, retryNonce]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-[#1c1915]">
      <div ref={hostRef} className={viewerHostClassName()} />
      {status !== "ready" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1c1915]/80 px-4">
          <p className="text-center text-sm text-[#fffcf8]">{message}</p>
          {status === "error" ? (
            <button
              type="button"
              className="rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white hover:bg-black/60"
              onClick={() => setRetryNonce((value) => value + 1)}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : (
        <ModelControls
          onReset={() => resetRef.current?.()}
          gridVisible={gridVisible}
          onToggleGrid={() => {
            const next = !gridVisible;
            setGridVisible(next);
            setGridRef.current?.(next);
          }}
        />
      )}
    </div>
  );
}

async function createViewer(host: HTMLDivElement, buffer: ArrayBuffer, filename: string) {
  const THREE = await import("three");
  const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
  const object = await loadMeshObject(buffer, filename);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c1915);
  scene.add(object);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.replaceChildren(renderer.domElement);

  const resize = () => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  resize();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;

  const { maxDim, cameraPosition } = fitCameraToObject(THREE, object, camera, controls.target);
  controls.update();

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(maxDim, maxDim, maxDim);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9bb8d4, 0.35);
  fill.position.set(-maxDim, maxDim * 0.4, -maxDim);
  scene.add(fill);

  const grid = new THREE.GridHelper(gridSizeForBounds(maxDim), 20, 0x6b635a, 0x3f3a34);
  grid.visible = false;
  scene.add(grid);

  const observer = new ResizeObserver(resize);
  observer.observe(host);

  let frame = 0;
  const tick = () => {
    frame = window.requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  return {
    reset() {
      camera.position.copy(cameraPosition);
      controls.target.set(0, 0, 0);
      controls.update();
    },
    setGridVisible(visible: boolean) {
      grid.visible = visible;
    },
    dispose() {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeObject(object);
      disposeObject(grid);
      disposeRenderer(renderer, host);
    },
  };
}
