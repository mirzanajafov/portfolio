import type { ReactNode } from 'react';

export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}
