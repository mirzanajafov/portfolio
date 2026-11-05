'use client';

import {
  channels,
  nextStatuses,
  type ApplicationPage,
  type Status,
} from '@portfolio/content/applications';
import { useActionState, type ReactNode } from 'react';
import { addApplication, editApplication, undoStatus } from './actions';

const input =
  'w-full min-w-0 rounded-lg border border-line bg-transparent px-3 py-2 outline-none focus:border-accent';

const submit = 'rounded-full bg-fg px-6 py-3 text-bg disabled:opacity-50';

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

function Failure({ failure }: { failure: string | null }) {
  return (
    failure && (
      <p role="alert" className="max-w-[65ch] whitespace-pre-line text-muted">
        {failure}
      </p>
    )
  );
}

function Fields({ application }: { application?: ApplicationPage }) {
  return (
    <>
      <Field label="Company">
        <input
          name="company"
          required
          maxLength={200}
          defaultValue={application?.company}
          className={input}
        />
      </Field>
      <Field label="Role">
        <input
          name="role"
          required
          maxLength={200}
          defaultValue={application?.role}
          className={input}
        />
      </Field>
      <Field label="Applied on">
        <input
          type="date"
          name="appliedOn"
          required
          defaultValue={application?.appliedOn}
          className={input}
        />
      </Field>
      <Field label="Channel">
        <select name="channel" required defaultValue={application?.channel ?? ''} className={input}>
          {!application && (
            <option value="" disabled>
              Choose one
            </option>
          )}
          {channels.map((channel) => (
            <option key={channel}>{channel}</option>
          ))}
        </select>
      </Field>
      <Field label="CV variant">
        <input
          name="cvVariant"
          required
          maxLength={100}
          defaultValue={application?.cvVariant}
          className={input}
        />
      </Field>
      <Field label="Country, as two capital letters">
        <input
          name="country"
          pattern="[A-Z]{2}"
          maxLength={2}
          defaultValue={application?.country ?? ''}
          className={input}
        />
      </Field>
      <Field label="City">
        <input
          name="city"
          maxLength={100}
          defaultValue={application?.city ?? ''}
          className={input}
        />
      </Field>
      <Field label="ATS host, or a link to the job">
        <input name="atsHost" defaultValue={application?.atsHost ?? ''} className={input} />
      </Field>
      <Field label="Networks the company runs, one per line" wide>
        <textarea
          name="networks"
          rows={2}
          defaultValue={application?.networks.join('\n')}
          className={input}
        />
      </Field>
    </>
  );
}

export function AddApplicationForm() {
  const [failure, action, pending] = useActionState<string | null, FormData>(addApplication, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Fields />
      <Field label="Code, only for one that already went out">
        <input name="code" pattern="[a-z0-9]{3,16}" maxLength={16} className={input} />
      </Field>
      <div className="flex flex-col items-start gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={submit}>
          Add
        </button>
        <Failure failure={failure} />
      </div>
    </form>
  );
}

export function EditApplicationForm({ application }: { application: ApplicationPage }) {
  const [failure, action, pending] = useActionState<string | null, FormData>(
    editApplication.bind(null, application.code),
    null,
  );
  const choices: Status[] = [application.status, ...nextStatuses[application.status]];
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Status">
        <select name="status" defaultValue={application.status} className={input}>
          {choices.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </Field>
      <Field label="First answer on">
        <input
          type="date"
          name="answeredOn"
          defaultValue={application.answeredOn ?? ''}
          className={input}
        />
      </Field>
      <Field label="Notes" wide>
        <textarea
          name="notes"
          rows={4}
          maxLength={2000}
          defaultValue={application.notes}
          className={input}
        />
      </Field>
      <Fields application={application} />
      <div className="flex flex-col items-start gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={submit}>
          Save
        </button>
        <Failure failure={failure} />
      </div>
    </form>
  );
}

export function UndoForm({ code, undoTo }: { code: string; undoTo: Status }) {
  const [failure, action, pending] = useActionState<string | null, FormData>(
    undoStatus.bind(null, code),
    null,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line px-4 py-2 hover:border-accent disabled:opacity-50"
      >
        Undo the last move, back to {undoTo}
      </button>
      <Failure failure={failure} />
    </form>
  );
}
