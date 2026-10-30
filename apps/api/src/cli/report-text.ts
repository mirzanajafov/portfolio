import type { Report } from '@portfolio/content/report';
import { reportSections, type ReportPart } from '@portfolio/content/report-sections';

function aligned(rows: readonly (readonly string[])[]): string[] {
  const widths = rows.reduce<number[]>(
    (widest, row) => row.map((cell, column) => Math.max(widest[column] ?? 0, cell.length)),
    [],
  );
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === 0 ? cell.padEnd(widths[column] ?? 0) : cell.padStart(widths[column] ?? 0),
      )
      .join('  ')
      .trimEnd(),
  );
}

function margin({ indent }: { indent: boolean }): string {
  return indent ? '  ' : '';
}

function partLines(part: ReportPart): string[] {
  switch (part.kind) {
    case 'table':
      return aligned(part.rows);
    case 'line':
      return [`${margin(part)}${part.text}`];
    case 'application':
      return [part.text];
    case 'more':
      return [`${margin(part)}${part.text}, --all shows them`];
  }
}

export function reportText(report: Report, { all }: { all: boolean }): string {
  const sections = reportSections(report, { all });
  return `${sections.map((section) => section.flatMap(partLines).join('\n')).join('\n\n')}\n`;
}
