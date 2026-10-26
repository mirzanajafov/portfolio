import type { Role } from '@portfolio/content';
import { formatPeriod, roleKey, roleKindLabel, rolePlace } from '@/lib/format';
import './experience.css';

export function RoleHeading({ role }: { role: Role }) {
  const label = roleKindLabel(role.kind);
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-lg font-semibold">
        {role.role}
        {role.company && (
          <>
            {' '}
            <span className="font-normal text-muted">at</span> {role.company}
          </>
        )}
      </h3>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span>{formatPeriod(role)}</span>
        <span aria-hidden="true">·</span>
        <span>{rolePlace(role)}</span>
        {label && (
          <span className="rounded-full border border-line px-2 py-0.5 text-xs">{label}</span>
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
          {role.about && <p className="max-w-3xl text-muted">{role.about}</p>}
        </li>
      ))}
    </ol>
  );
}
