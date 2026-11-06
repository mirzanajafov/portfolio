import type { ApplicationView } from '@portfolio/content/applications';
import Link from 'next/link';
import { ScrollRegion } from './scroll-region';
import { bodyCell, headCell } from './styles';

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
    <ScrollRegion label="Applications">
      <table className="text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`${headCell(index)} text-left whitespace-nowrap`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr key={application.code} className="border-t border-line">
              <td className={bodyCell(0)}>
                <Link
                  href={`/admin/applications/${application.code}`}
                  prefetch={false}
                  className="underline underline-offset-4"
                >
                  {application.company}, {application.role}
                </Link>
              </td>
              <td className={`${bodyCell(1)} whitespace-nowrap tabular-nums`}>
                {application.appliedOn}
              </td>
              <td className={bodyCell(2)}>{application.channel}</td>
              <td className={bodyCell(3)}>{application.cvVariant}</td>
              <td className={bodyCell(4)}>{application.status}</td>
              <td className={`${bodyCell(5)} whitespace-nowrap tabular-nums`}>
                {application.answeredOn ?? '-'}
              </td>
              <td className={`${bodyCell(6)} whitespace-nowrap tabular-nums`}>
                {application.firstSeenOn ?? '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}
