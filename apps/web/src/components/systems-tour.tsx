'use client';

import Link from 'next/link';
import { type CSSProperties, ViewTransition, useEffect, useRef, useState } from 'react';
import type { SceneName, UsedProject } from '@portfolio/content';
import { ProjectUses } from '@/components/project-uses';
import { ScenePlayer } from '@/components/scene-player';
import type { GraphApp } from '@/scenes/systems-graph';

export type TourStop = {
  id: string;
  name: string;
  hook: string;
  fact?: { text: string; kind: 'measured' | 'parameter' | 'design' };
  stack: string[];
  uses: UsedProject[];
  live?: string;
  code?: string;
  caseStudy?: string;
  privateSource?: boolean;
  demo?: { scene: SceneName; caption: string };
};

const settleMs = 500;

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
  const [scene, setScene] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [cards, setCards] = useState<Readonly<Record<string, number>>>({});
  const stepsRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const zones = stepsRef.current?.querySelectorAll<HTMLElement>('[data-scene]');
    if (!zones || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      setCards((previous) => {
        const measured = entries.map(
          (entry) =>
            [
              (entry.target.parentElement as HTMLElement).dataset.stop ?? '',
              Math.round(entry.target.getBoundingClientRect().height),
            ] as const,
        );
        return measured.every(([id, height]) => previous[id] === height)
          ? previous
          : { ...previous, ...Object.fromEntries(measured) };
      });
    });
    zones.forEach((zone) => {
      const card = zone.parentElement?.querySelector(':scope > .tour-card');
      if (card) observer.observe(card);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const steps = stepsRef.current?.querySelectorAll<HTMLElement>('[data-stop]');
    const zones = stepsRef.current?.querySelectorAll<HTMLElement>('[data-scene]');
    if (!steps || !zones || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const idOf = (entry: IntersectionObserverEntry) =>
      (entry.target as HTMLElement).dataset.stop ?? '';
    const inBand = new Set<string>();
    let current: string | null = null;
    const center = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const zone = (entry.target as HTMLElement).dataset.scene;
          if (zone) {
            setScene((shown) => (entry.isIntersecting ? zone : shown === zone ? null : shown));
          } else if (entry.isIntersecting) {
            inBand.add(idOf(entry));
            current = idOf(entry);
          } else {
            inBand.delete(idOf(entry));
          }
        }
        if (current !== null && !inBand.has(current)) {
          current = inBand.values().next().value ?? current;
        }
        setActive(current === 'overview' ? null : current);
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
    zones.forEach((zone) => center.observe(zone));
    return () => {
      center.disconnect();
      ahead.disconnect();
    };
  }, []);

  const showing = scene !== null && scene === active ? scene : null;

  useEffect(() => {
    if (!showing) {
      return;
    }
    const timer = window.setTimeout(() => setSettled(showing), settleMs);
    return () => window.clearTimeout(timer);
  }, [showing]);

  const covered = showing !== null && settled === showing;

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
                data-shown={showing === stop.id}
                aria-hidden={showing !== stop.id}
                inert={showing !== stop.id}
                style={
                  cards[stop.id]
                    ? ({ '--card-height': `${cards[stop.id]}px` } as CSSProperties)
                    : undefined
                }
              >
                <ScenePlayer
                  name={stop.demo.scene}
                  description={stop.demo.caption}
                  shown={showing === stop.id}
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
            <nav aria-label="Projects">
              <ol className="tour-index">
                {stops.map((stop, index) => (
                  <li key={stop.id}>
                    <a href={`#${stop.id}`}>
                      <span aria-hidden="true" className="tour-index-number">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="tour-index-name">{stop.name}</span>
                      <span className="tour-index-hook">{stop.hook}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </li>
        {stops.map((stop) => (
          <li
            key={stop.id}
            id={stop.id}
            data-stop={stop.id}
            className="tour-step"
            data-active={active === stop.id}
          >
            {stop.demo && (
              <div aria-hidden="true" className="tour-scene-zone" data-scene={stop.id} />
            )}
            <article aria-labelledby={`stop-${stop.id}`} className="tour-card">
              <ViewTransition name={`project-${stop.id}`} share="morph" default="none">
                <h3
                  id={`stop-${stop.id}`}
                  className="text-[clamp(28px,3.4vw,42px)] leading-none font-extrabold tracking-tight"
                >
                  {stop.name}
                </h3>
              </ViewTransition>
              <p className="tour-hook text-lg text-[var(--soft)]">{stop.hook}</p>
              {stop.fact && (
                <p className="tour-fact leading-relaxed">
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
                className="tour-stack flex flex-wrap gap-2 font-mono text-xs text-[var(--muted)]"
              >
                {stop.stack.map((tool) => (
                  <li key={tool} className="rounded-full border border-[var(--line)] px-3 py-1">
                    {tool}
                  </li>
                ))}
              </ul>
              <ProjectUses
                uses={stop.uses}
                tourPath=""
                className="tour-uses text-sm text-[var(--muted)]"
              />
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
