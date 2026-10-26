'use client';

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import type { PlayerHandle, SceneSpec } from '@/scenes/player';
import { webglAvailable } from '@/scenes/webgl';

function subscribeToNothing(): () => void {
  return () => undefined;
}

function useWebgl(): boolean {
  return useSyncExternalStore(subscribeToNothing, webglAvailable, () => true);
}

function sceneState(running: boolean, webgl: boolean, failed: boolean) {
  if (running) {
    return 'running';
  }
  if (!webgl) {
    return 'unsupported';
  }
  return failed ? 'failed' : 'loading';
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
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
  const webgl = useWebgl();
  const [failed, setFailed] = useState(false);
  const [readout, setReadout] = useState<string[]>([]);
  const choice = useMotionChoice();
  const playing = choice ?? !reducedMotion;
  const start = useEffectEvent(
    (canvas: HTMLCanvasElement, labels: HTMLElement, signal: AbortSignal) =>
      import('@/scenes/player').then(({ play }) =>
        play(scene, canvas, labels, { onReadout: setReadout, signal, playing, shown }),
      ),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const labels = labelsRef.current;
    if (!canvas || !labels || !webgl) {
      return;
    }
    const abort = new AbortController();
    let started: PlayerHandle | null = null;
    start(canvas, labels, abort.signal).then(
      (next) => {
        if (abort.signal.aborted) {
          next.dispose();
          return;
        }
        started = next;
        setHandle(next);
      },
      (error: unknown) => {
        if (!abort.signal.aborted) {
          console.error(`the ${scene.name} scene could not start`, error);
          setFailed(true);
        }
      },
    );
    return () => {
      abort.abort();
      started?.dispose();
      setHandle(null);
      setFailed(false);
      setReadout([]);
    };
  }, [scene.name, webgl]);

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
    <div className="scene" data-state={sceneState(handle !== null, webgl, failed)}>
      <canvas ref={canvasRef} className="scene-canvas" role="img" aria-label={description} />
      <div ref={labelsRef} className="scene-labels" aria-hidden="true" />
      {handle && (
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
