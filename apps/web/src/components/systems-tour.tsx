import Link from 'next/link';
import { ViewTransition } from 'react';
import type { Fact, UsedProject } from '@portfolio/content';
import { ProjectUses } from '@/components/project-uses';
import { StackList } from '@/components/stack-list';
import { TourScroller, type TourDemo } from '@/components/tour-scroller';
import { factKindLabel } from '@/lib/format';
import type { GraphApp } from '@/scenes/systems-graph';
import './systems-tour.css';

export type TourStop = {
  id: string;
  name: string;
  hook: string;
  fact: Pick<Fact, 'text' | 'kind'>;
  stack: string[];
  uses: UsedProject[];
  live?: string;
  code?: string;
  caseStudy?: string;
  privateSource?: boolean;
  demo?: TourDemo;
};

type Intro = { title: string; body: string };

const titleId = 'built';

function Overview({ intro, stops }: { intro: Intro; stops: TourStop[] }) {
  return (
    <>
      <h2
        id={titleId}
        className="text-[clamp(30px,4vw,48px)] leading-none font-extrabold tracking-tight"
      >
        {intro.title}
      </h2>
      <p className="text-lg leading-relaxed text-muted">{intro.body}</p>
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
    </>
  );
}

function StopCard({ stop, headingId }: { stop: TourStop; headingId: string }) {
  return (
    <>
      <ViewTransition name={`project-${stop.id}`} share="morph" default="none">
        <h3
          id={headingId}
          className="text-[clamp(28px,3.4vw,42px)] leading-none font-extrabold tracking-tight"
        >
          {stop.name}
        </h3>
      </ViewTransition>
      <p className="tour-hook text-lg text-soft">{stop.hook}</p>
      <p className="tour-fact leading-relaxed">
        {stop.fact.text}
        {stop.fact.kind === 'parameter' && (
          <span className="ml-2 rounded-full border border-line px-2 py-0.5 align-middle font-mono text-[11px] whitespace-nowrap text-muted">
            {factKindLabel(stop.fact.kind)}
          </span>
        )}
      </p>
      <StackList stack={stop.stack} className="tour-stack" />
      <ProjectUses uses={stop.uses} className="tour-uses" />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {stop.caseStudy && (
          <Link
            className="font-medium text-accent underline underline-offset-4"
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
          <span className="text-sm text-muted">Source available on request</span>
        )}
      </div>
    </>
  );
}

export function SystemsTour({
  intro,
  stops,
  apps,
}: {
  intro: Intro;
  stops: TourStop[];
  apps: GraphApp[];
}) {
  return (
    <TourScroller
      apps={apps}
      titleId={titleId}
      overview={<Overview intro={intro} stops={stops} />}
      stops={stops.map((stop) => {
        const headingId = `stop-${stop.id}`;
        return {
          id: stop.id,
          headingId,
          demo: stop.demo,
          card: <StopCard stop={stop} headingId={headingId} />,
        };
      })}
    />
  );
}
