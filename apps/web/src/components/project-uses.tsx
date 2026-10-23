import type { UsedProject } from '@portfolio/content';

export function ProjectUses({
  uses,
  tourPath,
  className,
}: {
  uses: UsedProject[];
  tourPath: '' | '/';
  className: string;
}) {
  return uses.map((used) => (
    <p key={used.slug} className={className}>
      Uses{' '}
      <a className="underline underline-offset-4" href={`${tourPath}#${used.slug}`}>
        {used.name}
      </a>{' '}
      for {used.for}
    </p>
  ));
}
