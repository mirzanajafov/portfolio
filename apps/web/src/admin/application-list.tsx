import type { ApplicationView } from '@portfolio/content/applications';
import Link from 'next/link';

const columns = [
  'Application',
  'Applied',
  'Channel',
  'Variant',
  'Status',
  'Answered',
  'First opened',
];

export function ApplicationList({ applications }: { applications: ApplicationView[] }) {
  if (applications.length === 0) {
    return <p className="text-muted">No applications yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-2 py-1 text-left font-semibold whitespace-nowrap"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.code} className="border-t border-line">
              <td className="px-2 py-1">
                <Link
                  href={`/admin/applications/${application.code}`}
                  prefetch={false}
                  className="underline underline-offset-4"
                >
                  {application.company}, {application.role}
                </Link>
              </td>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">{application.appliedOn}</td>
              <td className="px-2 py-1">{application.channel}</td>
              <td className="px-2 py-1">{application.cvVariant}</td>
              <td className="px-2 py-1">{application.status}</td>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                {application.answeredOn ?? '-'}
              </td>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                {application.firstSeenOn ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
