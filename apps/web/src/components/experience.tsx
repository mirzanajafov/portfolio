import type { Role } from '@portfolio/content';
import { formatPeriod, kindLabel, roleKey } from '@/lib/format';

export function RoleHeading({ role }: { role: Role }) {
  const label = kindLabel(role.kind);
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-lg font-semibold">
        {role.role}
        {role.company && (
          <>
            {' '}
            <span className="font-normal text-[var(--muted)]">at</span> {role.company}
          </>
        )}
      </h3>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-[var(--muted)]">
        <span>{formatPeriod(role)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {role.location}
          {role.remote && ' (remote)'}
        </span>
        {label && (
          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
            {label}
          </span>
        )}
      </p>
    </div>
  );
}

export function ExperienceTimeline({ roles }: { roles: Role[] }) {
  return (
    <ol className="timeline relative flex flex-col gap-6 pl-6">
      {roles.map((role) => (
        <li key={roleKey(role)} className="flex flex-col gap-2">
          <RoleHeading role={role} />
          {role.about && <p className="text-[var(--muted)]">{role.about}</p>}
        </li>
      ))}
    </ol>
  );
}
