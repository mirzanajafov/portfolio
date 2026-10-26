'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlayerHandle, SceneSpec } from '@/scenes/player';

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia?.(reducedMotionQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia?.(reducedMotionQuery).matches ?? false,
    () => false,
  );
}

let motionChoice: boolean | null = null;
const motionListeners = new Set<() => void>();

function subscribeToMotionChoice(onChange: () => void): () => void {
  motionListeners.add(onChange);
  return () => motionListeners.delete(onChange);
}

function chooseMotion(playing: boolean) {
  motionChoice = playing;
  motionListeners.forEach((listener) => listener());
}

function useMotionChoice(): boolean | null {
  return useSyncExternalStore(
    subscribeToMotionChoice,
    () => motionChoice,
    () => null,
  );
}

export function ScenePlayer({
  scene,
  description,
  showReadout = true,
  focus = null,
  shown = true,
}: {
  scene: SceneSpec;
  description: string;
  showReadout?: boolean;
  focus?: string | null;
  shown?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PlayerHandle | null>(null);
  const sceneRef = useRef(scene);
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<'loading' | 'running' | 'unsupported'>('loading');
  const [readout, setReadout] = useState<string[]>([]);
  const choice = useMotionChoice();
  const playing = choice ?? !reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) {
      return;
    }
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!webglAvailable()) {
          throw new Error('no WebGL');
        }
        return import('@/scenes/player');
      })
      .then(({ play }) => play(sceneRef.current, canvas, labels, setReadout))
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        handleRef.current = handle;
        setState('running');
      })
      .catch(() => {
        if (!cancelled) {
          setState('unsupported');
        }
      });
    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
      labels.replaceChildren();
    };
  }, [scene.name]);

  useEffect(() => {
    handleRef.current?.setPlaying(playing);
  }, [playing, state]);

  useEffect(() => {
    handleRef.current?.focus(focus);
  }, [focus, state]);

  useEffect(() => {
    handleRef.current?.setShown(shown);
  }, [shown, state]);

  return (
    <div className="scene" data-state={state}>
      <canvas ref={canvasRef} className="scene-canvas" role="img" aria-label={description} />
      <div ref={labelsRef} className="scene-labels" aria-hidden="true" />
      {state === 'running' && (
        <div className="scene-hud">
          {showReadout ? (
            <p className="scene-readout" aria-hidden="true">
              {readout.map((line, index) => (
                <span key={index}>{line}</span>
              ))}
            </p>
          ) : (
            <span />
          )}
          <div className="scene-controls">
            <button type="button" className="scene-button" onClick={() => chooseMotion(!playing)}>
              {playing ? 'Pause motion' : 'Play motion'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
