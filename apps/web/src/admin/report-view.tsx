import type { ReportPart, ReportSection } from '@portfolio/content/report-sections';
import Link from 'next/link';
import { ScrollRegion } from './scroll-region';
import { bodyCell, headCell } from './styles';

type Heading = { id: string; text: string; label: string };

type TextPart = Exclude<ReportPart, { kind: 'table' }>;

export type TitledSection = { heading: Heading | null; parts: ReportPart[]; titledTable: boolean };

const letter = /\p{L}/u;

function titleOf([first]: ReportSection): string | null {
  if (first?.kind === 'table') {
    return first.rows[0]?.[0] ?? null;
  }
  return first?.kind === 'line' ? first.text : null;
}

function slugOf(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

export function titledSections(
  sections: readonly ReportSection[],
  reservedIds: readonly string[],
): TitledSection[] {
  const taken = new Set(reservedIds);
  return sections.map((section) => {
    const text = titleOf(section);
    if (text === null) {
      return { heading: null, parts: section, titledTable: false };
    }
    const label = text.split(/[:,]/)[0]?.trim() ?? text;
    const slug = slugOf(label);
    let id = slug;
    for (let next = 2; taken.has(id); next += 1) {
      id = `${slug}-${String(next)}`;
    }
    taken.add(id);
    const titledTable = section[0]?.kind === 'table';
    return {
      heading: { id, text, label },
      parts: titledTable ? section : section.slice(1),
      titledTable,
    };
  });
}

function Table({
  rows: [head = [], ...body],
  label,
  titled,
}: {
  rows: string[][];
  label: string;
  titled: boolean;
}) {
  const alignOf = (column: number) => (column === 0 ? 'text-left' : 'text-right whitespace-nowrap');
  const figuresOf = (column: number, cell: string) =>
    column === 0 || letter.test(cell) ? '' : 'tabular-nums';
  return (
    <ScrollRegion label={label}>
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

function Text({ part }: { part: TextPart }) {
  switch (part.kind) {
    case 'line':
      return <p className={part.indent ? 'pl-4 text-sm' : undefined}>{part.text}</p>;
    case 'application':
      return (
        <p>
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
      return <p className={`text-sm text-muted ${part.indent ? 'pl-4' : ''}`}>{part.text}</p>;
    case 'none':
      return <p className="text-sm text-muted">{part.text}</p>;
  }
}

export function ReportView({ sections }: { sections: readonly TitledSection[] }) {
  return (
    <div>
      {sections.map(({ heading, parts, titledTable }, index) =>
        heading === null ? (
          <section key={index} className="mt-3 [&>p]:max-w-[75ch]">
            {parts.map((part, position) =>
              part.kind === 'table' ? null : <Text key={position} part={part} />,
            )}
          </section>
        ) : (
          <section
            key={index}
            className="mt-8 flex flex-col gap-3 border-t border-line pt-8 break-words first:mt-0 [&>h2]:max-w-[75ch] [&>p]:max-w-[75ch]"
          >
            <h2 id={heading.id} className="scroll-mt-4 text-lg font-semibold">
              {heading.text}
            </h2>
            {parts.map((part, position) =>
              part.kind === 'table' ? (
                <Table
                  key={position}
                  rows={part.rows}
                  label={heading.label}
                  titled={titledTable && position === 0}
                />
              ) : (
                <Text key={position} part={part} />
              ),
            )}
          </section>
        ),
      )}
    </div>
  );
}
