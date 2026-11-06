export const pill = 'rounded-full border border-line px-4 py-2 hover:border-accent';

export const submit = 'rounded-full bg-fg px-6 py-3 text-bg disabled:opacity-50';

const firstColumn = 'sticky left-0 bg-bg';

export const headCell = (column: number) =>
  `px-3 py-1 text-xs font-medium text-muted ${column === 0 ? firstColumn : ''}`;

export const bodyCell = (column: number) => `px-3 py-1 ${column === 0 ? firstColumn : ''}`;
