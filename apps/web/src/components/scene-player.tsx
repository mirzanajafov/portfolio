'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
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
  const [handle, setHandle] = useState<PlayerHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<'loading' | 'running' | 'unsupported'>('loading');
  const [readout, setReadout] = useState<string[]>([]);
  const choice = useMotionChoice();
  const playing = choice ?? !reducedMotion;
  const start = useEffectEvent((canvas: HTMLCanvasElement, labels: HTMLElement) =>
    import('@/scenes/player').then(({ play }) => play(scene, canvas, labels, setReadout)),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels) {
      return;
    }
    let cancelled = false;
    let started: PlayerHandle | null = null;
    Promise.resolve()
      .then(() => {
        if (!webglAvailable()) {
          throw new Error('no WebGL');
        }
        return cancelled ? null : start(canvas, labels);
      })
      .then((next) => {
        if (!next) {
          return;
        }
        if (cancelled) {
          next.dispose();
          return;
        }
        started = next;
        setHandle(next);
        setState('running');
      })
      .catch(() => {
        if (!cancelled) {
          setState('unsupported');
        }
      });
    return () => {
      cancelled = true;
      started?.dispose();
      setHandle(null);
      setState('loading');
      setReadout([]);
      labels.replaceChildren();
    };
  }, [scene.name]);

  useEffect(() => {
    handle?.setPlaying(playing);
  }, [handle, playing]);

  useEffect(() => {
    handle?.focus(focus);
  }, [handle, focus]);

  useEffect(() => {
    handle?.setShown(shown);
  }, [handle, shown]);

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
