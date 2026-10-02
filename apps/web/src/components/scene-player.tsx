'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PlayerHandle, SceneName } from '@/scenes/player';
import type { LegendItem } from '@/scenes/types';

export function webglAvailable(): boolean {
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

export function ScenePlayer({
  name,
  description,
  showLegend = false,
}: {
  name: SceneName;
  description: string;
  showLegend?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<PlayerHandle | null>(null);
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<'loading' | 'running' | 'unsupported'>('loading');
  const [readout, setReadout] = useState<string[]>([]);
  const [legend, setLegend] = useState<LegendItem[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [choice, setChoice] = useState<boolean | null>(null);
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
      .then(({ play }) =>
        play(name, canvas, labels, { onReadout: setReadout, onLegend: setLegend }),
      )
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
  }, [name]);

  useEffect(() => {
    handleRef.current?.setPlaying(playing);
  }, [playing, state]);

  useEffect(() => {
    handleRef.current?.focus(focus);
  }, [focus, state]);

  return (
    <div className="scene" data-state={state}>
      <canvas ref={canvasRef} className="scene-canvas" role="img" aria-label={description} />
      <div ref={labelsRef} className="scene-labels" aria-hidden="true" />
      {state === 'running' && (
        <div className="scene-hud">
          <p className="scene-readout" aria-hidden="true">
            {readout.map((line, index) => (
              <span key={index}>{line}</span>
            ))}
          </p>
          <div className="scene-controls">
            <button type="button" className="scene-button" onClick={() => setChoice(!playing)}>
              {playing ? 'Pause motion' : 'Play motion'}
            </button>
            {showLegend && legend.length > 0 && (
              <div className="scene-legend" role="group" aria-label="Follow one project">
                {legend.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="scene-button"
                    aria-pressed={focus === item.id}
                    onClick={() => setFocus(focus === item.id ? null : item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
