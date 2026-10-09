'use client';

import Link from 'next/link';
import { ViewTransition, useEffect, useRef, useState } from 'react';
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
};

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
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const steps = stepsRef.current?.querySelectorAll<HTMLElement>('[data-stop]');
    if (!steps || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.stop ?? '';
            setActive(id === 'overview' ? null : id);
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby="built" className="tour">
      <div className="tour-stage">
        <ScenePlayer
          name="systems"
          data={apps}
          focus={active}
          showReadout={false}
          description="A map of the apps I run on my server. Each app sits around the server with its own stack, and requests travel from the server to the apps and into their parts. Scrolling moves the camera from app to app."
        />
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
