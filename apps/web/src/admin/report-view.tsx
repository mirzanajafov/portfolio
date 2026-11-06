import type { ReportPart, ReportSection } from '@portfolio/content/report-sections';
import Link from 'next/link';
import { ScrollRegion } from './scroll-region';
import { bodyCell, headCell } from './styles';

type TextPart = Exclude<ReportPart, { kind: 'table' }>;

const letter = /\p{L}/u;

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
  }
}

function Titled({ section }: { section: Extract<ReportSection, { kind: 'titled' }> }) {
  const { id, label, opening, parts } = section;
  return (
    <section className="mt-8 flex flex-col gap-3 border-t border-line pt-8 break-words first:mt-0 [&>h2]:max-w-[75ch] [&>p]:max-w-[75ch]">
      <h2 id={id} className="scroll-mt-4 text-lg font-semibold">
        {opening.kind === 'line' ? opening.text : opening.rows[0]?.[0]}
      </h2>
      {opening.kind === 'table' && <Table rows={opening.rows} label={label} titled />}
      {parts.map((part, position) =>
        part.kind === 'table' ? (
          <Table
            key={position}
            rows={part.rows}
            label={`${label}, ${part.rows[0]?.[0] ?? ''}`}
            titled={false}
          />
        ) : (
          <Text key={position} part={part} />
        ),
      )}
    </section>
  );
}

export function ReportView({ sections }: { sections: readonly ReportSection[] }) {
  return (
    <div>
      {sections.map((section, index) =>
        section.kind === 'titled' ? (
          <Titled key={section.id} section={section} />
        ) : (
          <p key={index} className="mt-3 max-w-[75ch] text-sm text-muted">
            {section.text}
          </p>
        ),
      )}
    </div>
  );
}
