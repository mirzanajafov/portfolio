'use client';

import Link from 'next/link';
import { ViewTransition, useEffect, useRef, useState } from 'react';
import type { SceneName } from '@portfolio/content';
import { ScenePlayer } from '@/components/scene-player';
import type { GraphApp } from '@/scenes/systems-graph';

export type TourStop = {
  id: string;
  name: string;
  hook: string;
  fact?: { text: string; kind: 'measured' | 'parameter' | 'design' };
  stack: string[];
  live?: string;
  code?: string;
  caseStudy?: string;
  privateSource?: boolean;
  demo?: { scene: SceneName; caption: string };
};

const settleMs = 900;

export function SystemsTour({
  intro,
  stops,
  apps,
}: {
  intro: { title: string; body: string };
  stops: TourStop[];
  apps: GraphApp[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const [settled, setSettled] = useState<string | null>(null);
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const steps = stepsRef.current?.querySelectorAll<HTMLElement>('[data-stop]');
    if (!steps || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const idOf = (entry: IntersectionObserverEntry) =>
      (entry.target as HTMLElement).dataset.stop ?? '';
    const center = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = idOf(entry);
            setActive(id === 'overview' ? null : id);
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    const ahead = new IntersectionObserver(
      (entries) => {
        const coming = entries.filter((entry) => entry.isIntersecting).map(idOf);
        if (coming.length > 0) {
          setNear((previous) =>
            coming.every((id) => previous.has(id)) ? previous : new Set([...previous, ...coming]),
          );
        }
      },
      { rootMargin: '50% 0px 50% 0px' },
    );
    steps.forEach((step) => {
      center.observe(step);
      ahead.observe(step);
    });
    return () => {
      center.disconnect();
      ahead.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setTimeout(() => setSettled(active), settleMs);
    return () => window.clearTimeout(timer);
  }, [active]);

  const covered = settled === active && stops.some((stop) => stop.id === active && stop.demo);

  return (
    <section aria-labelledby="built" className="tour">
      <div className="tour-stage">
        <ScenePlayer
          name="systems"
          data={apps}
          focus={active}
          shown={!covered}
          showReadout={false}
          description="A map of the apps I run on my server. Each app sits around the server with its own stack, and requests travel from the server to the apps and into their parts. Scrolling moves the camera from app to app."
        />
        {stops.map(
          (stop) =>
            stop.demo &&
            near.has(stop.id) && (
              <div
                key={stop.id}
                className="tour-demo"
                data-stop={stop.id}
                data-shown={active === stop.id}
                aria-hidden={active !== stop.id}
                inert={active !== stop.id}
              >
                <ScenePlayer
                  name={stop.demo.scene}
                  description={stop.demo.caption}
                  shown={active === stop.id}
                />
                <p className="tour-caption" aria-hidden="true">
                  {stop.demo.caption}
                </p>
              </div>
            ),
        )}
      </div>
      <ol ref={stepsRef} className="tour-steps">
        <li data-stop="overview" className="tour-step">
          <div className="tour-card">
            <h2
              id="built"
              className="text-[clamp(30px,4vw,48px)] leading-none font-extrabold tracking-tight"
            >
              {intro.title}
            </h2>
            <p className="text-lg leading-relaxed text-[var(--muted)]">{intro.body}</p>
          </div>
        </li>
        {stops.map((stop) => (
          <li
            key={stop.id}
            data-stop={stop.id}
            className="tour-step"
            data-active={active === stop.id}
          >
            <article aria-labelledby={`stop-${stop.id}`} className="tour-card">
              <ViewTransition name={`project-${stop.id}`} share="morph" default="none">
                <h3
                  id={`stop-${stop.id}`}
                  className="text-[clamp(28px,3.4vw,42px)] leading-none font-extrabold tracking-tight"
                >
                  {stop.name}
                </h3>
              </ViewTransition>
              <p className="text-lg text-[var(--soft)]">{stop.hook}</p>
              {stop.fact && (
                <p className="leading-relaxed">
                  {stop.fact.text}
                  {stop.fact.kind === 'parameter' && (
                    <span className="ml-2 rounded-full border border-[var(--line)] px-2 py-0.5 align-middle font-mono text-[11px] whitespace-nowrap text-[var(--muted)]">
                      design parameter
                    </span>
                  )}
                </p>
              )}
              <ul
                aria-label="Built with"
                className="flex flex-wrap gap-2 font-mono text-xs text-[var(--muted)]"
              >
                {stop.stack.map((tool) => (
                  <li key={tool} className="rounded-full border border-[var(--line)] px-3 py-1">
                    {tool}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {stop.caseStudy && (
                  <Link
                    className="font-medium text-[var(--accent)] underline underline-offset-4"
                    href={stop.caseStudy}
                  >
                    Case study
                  </Link>
                )}
                {stop.live && (
                  <a className="font-medium underline underline-offset-4" href={stop.live}>
                    Live
                  </a>
                )}
                {stop.code && (
                  <a className="font-medium underline underline-offset-4" href={stop.code}>
                    Code
                  </a>
                )}
                {stop.privateSource && (
                  <span className="text-sm text-[var(--muted)]">Source available on request</span>
                )}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
