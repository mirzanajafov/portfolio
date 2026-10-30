import type { ReportPart, ReportSection } from '@portfolio/content/report-sections';

function Table({ rows: [head = [], ...body] }: { rows: string[][] }) {
  const cellClass = (column: number) =>
    column === 0 ? 'text-left' : 'text-right tabular-nums whitespace-nowrap';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {head.map((cell, column) => (
              <th
                key={column}
                scope="col"
                className={`px-2 py-1 font-semibold ${cellClass(column)}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {row.map((cell, column) => (
                <td key={column} className={`px-2 py-1 ${cellClass(column)}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Part({ part, first }: { part: ReportPart; first: boolean }) {
  switch (part.kind) {
    case 'table':
      return <Table rows={part.rows} />;
    case 'line':
      if (part.indent) {
        return <p className="pl-4 text-sm">{part.text}</p>;
      }
      return <p className={first ? 'font-semibold' : undefined}>{part.text}</p>;
    case 'application':
      return (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span>{part.text}</span>
          <a
            className="text-sm underline underline-offset-4"
            href={`/admin/applications/${encodeURIComponent(part.code)}/cv`}
            aria-label={`Download CV for ${part.code}`}
          >
            Download CV
          </a>
        </p>
      );
    case 'more':
      return <p className={`text-sm text-muted ${part.indent ? 'pl-4' : ''}`}>{part.text}</p>;
  }
}

export function ReportView({ sections }: { sections: ReportSection[] }) {
  return sections.map((section, index) => (
    <section key={index} className="flex flex-col gap-2 border-t border-line pt-6 break-words">
      {section.map((part, position) => (
        <Part key={position} part={part} first={position === 0} />
      ))}
    </section>
  ));
}
