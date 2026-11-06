import type { ReportPart, ReportSection } from '@portfolio/content/report-sections';
import Link from 'next/link';
import { ScrollRegion } from './scroll-region';
import { bodyCell, headCell } from './styles';

type Heading = { id: string; text: string; label: string };

type Shown = { heading: Heading | null; parts: ReportPart[]; titledTable: boolean };

const letter = /\p{L}/u;

function titleOf([first, ...rest]: ReportSection): string | null {
  if (first?.kind === 'table') {
    return first.rows[0]?.[0] ?? null;
  }
  return first?.kind === 'line' && rest.length > 0 ? first.text : null;
}

function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

function shownOf(sections: readonly ReportSection[]): Shown[] {
  const taken = new Map<string, number>();
  return sections.map((section) => {
    const text = titleOf(section);
    if (text === null) {
      return { heading: null, parts: section, titledTable: false };
    }
    const label = text.split(/[:,]/)[0]?.trim() ?? text;
    const slug = slugOf(label);
    const seen = taken.get(slug) ?? 0;
    taken.set(slug, seen + 1);
    const titledTable = section[0]?.kind === 'table';
    return {
      heading: { id: seen === 0 ? slug : `${slug}-${String(seen + 1)}`, text, label },
      parts: titledTable ? section : section.slice(1),
      titledTable,
    };
  });
}

function Table({ rows: [head = [], ...body], titled }: { rows: string[][]; titled: boolean }) {
  const alignOf = (column: number) => (column === 0 ? 'text-left' : 'text-right whitespace-nowrap');
  const figuresOf = (column: number, cell: string) =>
    column === 0 || letter.test(cell) ? '' : 'tabular-nums';
  return (
    <ScrollRegion label={head[0] ?? ''}>
      <table className="text-sm">
        <thead>
          <tr>
            {head.map((cell, column) => (
              <th key={column} scope="col" className={`${headCell(column)} ${alignOf(column)}`}>
                {column === 0 && titled ? <span className="sr-only">{cell}</span> : cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {row.map((cell, column) => (
                <td
                  key={column}
                  className={`${bodyCell(column)} ${alignOf(column)} ${figuresOf(column, cell)}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

function Part({ part, titled }: { part: ReportPart; titled: boolean }) {
  switch (part.kind) {
    case 'table':
      return <Table rows={part.rows} titled={titled} />;
    case 'line':
      return (
        <p className={part.indent ? 'max-w-[75ch] pl-4 text-sm' : 'max-w-[75ch]'}>{part.text}</p>
      );
    case 'application':
      return (
        <p className="max-w-[75ch]">
          {part.text}{' '}
          <Link
            className="ml-1 text-sm whitespace-nowrap underline underline-offset-4"
            href={`/admin/applications/${encodeURIComponent(part.code)}`}
            prefetch={false}
            aria-label={`Open ${part.code}`}
          >
            Open
          </Link>
        </p>
      );
    case 'more':
      return (
        <p className={`max-w-[75ch] text-sm text-muted ${part.indent ? 'pl-4' : ''}`}>
          {part.text}
        </p>
      );
    case 'none':
      return <p className="max-w-[75ch] text-sm text-muted">{part.text}</p>;
  }
}

export function headingsOf(sections: readonly ReportSection[]): Heading[] {
  return shownOf(sections).flatMap(({ heading }) => (heading ? [heading] : []));
}

export function ReportView({ sections }: { sections: readonly ReportSection[] }) {
  return (
    <div>
      {shownOf(sections).map(({ heading, parts, titledTable }, index) =>
        parts.length === 1 && parts[0]?.kind === 'none' ? (
          <section key={index} className="mt-3">
            <Part part={parts[0]} titled={false} />
          </section>
        ) : (
          <section
            key={index}
            className="mt-8 flex flex-col gap-3 border-t border-line pt-8 break-words first:mt-0"
          >
            {heading && (
              <h2 id={heading.id} className="max-w-[75ch] scroll-mt-4 text-lg font-semibold">
                {heading.text}
              </h2>
            )}
            {parts.map((part, position) => (
              <Part key={position} part={part} titled={titledTable && position === 0} />
            ))}
          </section>
        ),
      )}
    </div>
  );
}
