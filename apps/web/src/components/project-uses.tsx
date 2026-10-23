import Link from 'next/link';
import type { UsedProject } from '@portfolio/content';

export function ProjectUses({ uses, className = '' }: { uses: UsedProject[]; className?: string }) {
  return uses.map((used) => (
    <p key={used.slug} className={[className, 'text-sm text-[var(--muted)]'].join(' ').trim()}>
      Uses{' '}
      <Link className="underline underline-offset-4" href={`/#${used.slug}`}>
        {used.name}
      </Link>{' '}
      for {used.for}
    </p>
  ));
}
