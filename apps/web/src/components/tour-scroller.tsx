'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ScenePlayer } from '@/components/scene-player';
import type { TourStop } from '@/components/systems-tour';
import type { GraphApp } from '@/scenes/systems-graph';

type ScrollStop = { id: string; headingId: string; demo?: TourStop['demo']; card: ReactNode };

const settleMs = 500;

function track(ids: Map<Element, string>, id: string, element: Element | null) {
  if (!element) {
    return;
  }
  ids.set(element, id);
  return () => {
    ids.delete(element);
  };
}

function crossings(entries: IntersectionObserverEntry[], ids: ReadonlyMap<Element, string>) {
  return entries.flatMap(({ target, isIntersecting }) => {
    const id = ids.get(target);
    return id === undefined ? [] : [{ id, isIntersecting }];
  });
}

export function TourScroller({
  apps,
  titleId,
  overview,
  stops,
}: {
  apps: GraphApp[];
  titleId: string;
  overview: ReactNode;
  stops: ScrollStop[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const [near, setNear] = useState<ReadonlySet<string>>(new Set());
  const [scene, setScene] = useState<string | null>(null);
  const [settled, setSettled] = useState<string | null>(null);
  const [cards, setCards] = useState<Readonly<Record<string, number>>>({});
  const steps = useRef(new Map<Element, string>());
  const zones = useRef(new Map<Element, string>());
  const demoCards = useRef(new Map<Element, string>());

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const measured = entries.flatMap(({ target }): [string, number][] => {
        const id = demoCards.current.get(target);
        return id === undefined ? [] : [[id, Math.round(target.getBoundingClientRect().height)]];
      });
      setCards((previous) =>
        measured.every(([id, height]) => previous[id] === height)
          ? previous
          : { ...previous, ...Object.fromEntries(measured) },
      );
    });
    demoCards.current.forEach((_, card) => {
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const band = { rootMargin: '-45% 0px -45% 0px' };
    const inBand = new Set<string>();
    let current: string | null = null;
    const stepBand = new IntersectionObserver((entries) => {
      for (const { id, isIntersecting } of crossings(entries, steps.current)) {
        if (isIntersecting) {
          inBand.add(id);
          current = id;
        } else {
          inBand.delete(id);
        }
      }
      if (current !== null && !inBand.has(current)) {
        current = inBand.values().next().value ?? current;
      }
      setActive(current === 'overview' ? null : current);
    }, band);
    const zoneBand = new IntersectionObserver((entries) => {
      for (const { id, isIntersecting } of crossings(entries, zones.current)) {
        if (isIntersecting) {
          setScene(id);
        } else {
          setScene((shown) => (shown === id ? null : shown));
        }
      }
    }, band);
    const ahead = new IntersectionObserver(
      (entries) => {
        const coming = crossings(entries, steps.current)
          .filter(({ isIntersecting }) => isIntersecting)
          .map(({ id }) => id);
        if (coming.length > 0) {
          setNear((previous) =>
            coming.every((id) => previous.has(id)) ? previous : new Set([...previous, ...coming]),
          );
        }
      },
      { rootMargin: '50% 0px 50% 0px' },
    );
    steps.current.forEach((_, step) => {
      stepBand.observe(step);
      ahead.observe(step);
    });
    zones.current.forEach((_, zone) => {
      zoneBand.observe(zone);
    });
    return () => {
      stepBand.disconnect();
      zoneBand.disconnect();
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
    <section aria-labelledby={titleId} className="tour">
      <div className="tour-stage">
        <ScenePlayer
          scene={{ name: 'systems', apps }}
          focus={active}
          shown={!covered}
          showReadout={false}
          description="A map of the apps I run on my server. Each app sits around the server with its own stack, and requests travel from the server to the apps and into their parts. Scrolling moves the camera from app to app."
        />
        {stops.map(({ id, demo }) => {
          if (!demo || !near.has(id)) {
            return null;
          }
          const cardHeight = cards[id];
          return (
            <div
              key={id}
              className="tour-demo"
              data-shown={showing === id}
              aria-hidden={showing !== id}
              inert={showing !== id}
              style={cardHeight === undefined ? undefined : { '--card-height': `${cardHeight}px` }}
            >
              <ScenePlayer
                scene={{ name: demo.scene }}
                description={demo.caption}
                shown={showing === id}
              />
              <p className="tour-caption" aria-hidden="true">
                {demo.caption}
              </p>
            </div>
          );
        })}
      </div>
      <ol className="tour-steps">
        <li
          ref={(element) => track(steps.current, 'overview', element)}
          data-stop="overview"
          className="tour-step"
        >
          <div className="tour-card">{overview}</div>
        </li>
        {stops.map(({ id, headingId, demo, card }) => (
          <li
            key={id}
            ref={(element) => track(steps.current, id, element)}
            id={id}
            className="tour-step"
            data-active={active === id}
          >
            {demo && (
              <div
                ref={(element) => track(zones.current, id, element)}
                aria-hidden="true"
                className="tour-scene-zone"
              />
            )}
            <article
              ref={demo ? (element) => track(demoCards.current, id, element) : undefined}
              aria-labelledby={headingId}
              className="tour-card"
            >
              {card}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
