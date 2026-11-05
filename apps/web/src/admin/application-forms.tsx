'use client';

import {
  channels,
  nextStatuses,
  type ApplicationView,
  type Status,
} from '@portfolio/content/applications';
import { useActionState, type ReactNode } from 'react';
import { addApplication, editApplication, undoStatus, type FormState } from './actions';
import type { editFields, FormValues } from './application-fields';
import { pill } from './styles';

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

function shownValues(application: ApplicationView): Record<(typeof editFields)[number], string> {
  return {
    company: application.company,
    role: application.role,
    appliedOn: application.appliedOn,
    channel: application.channel,
    cvVariant: application.cvVariant,
    status: application.status,
    answeredOn: application.answeredOn ?? '',
    notes: application.notes,
    country: application.country ?? '',
    city: application.city ?? '',
    atsHost: application.atsHost ?? '',
    networks: application.networks.join('\n'),
  };
}

function Fields({ values, choosing }: { values: FormValues; choosing: boolean }) {
  return (
    <>
      <Field label="Company">
        <input name="company" required defaultValue={values.company} className={input} />
      </Field>
      <Field label="Role">
        <input name="role" required defaultValue={values.role} className={input} />
      </Field>
      <Field label="Applied on">
        <input
          type="date"
          name="appliedOn"
          required
          defaultValue={values.appliedOn}
          className={input}
        />
      </Field>
      <Field label="Channel">
        <select name="channel" required defaultValue={values.channel ?? ''} className={input}>
          {choosing && (
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
        <input name="cvVariant" required defaultValue={values.cvVariant} className={input} />
      </Field>
      <Field label="Country code, two letters">
        <input name="country" defaultValue={values.country} className={input} />
      </Field>
      <Field label="City">
        <input name="city" defaultValue={values.city} className={input} />
      </Field>
      <Field label="ATS host, or a link to the job">
        <input name="atsHost" defaultValue={values.atsHost} className={input} />
      </Field>
      <Field label="Networks the company runs, one per line" wide>
        <textarea name="networks" rows={2} defaultValue={values.networks} className={input} />
      </Field>
    </>
  );
}

export function AddApplicationForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addApplication, null);
  const values = state?.values ?? {};
  return (
    <form key={JSON.stringify(values)} action={action} className="grid gap-4 sm:grid-cols-2">
      <Fields values={values} choosing />
      <Field label="Code, only for one that already went out">
        <input name="code" defaultValue={values.code} className={input} />
      </Field>
      <div className="flex flex-col items-start gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={submit}>
          Add
        </button>
        <Failure failure={state?.failure ?? null} />
      </div>
    </form>
  );
}

export function EditApplicationForm({ application }: { application: ApplicationView }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    editApplication.bind(null, application.code),
    null,
  );
  const shown = shownValues(application);
  const values = state?.values ?? shown;
  const choices: Status[] = [application.status, ...nextStatuses[application.status]];
  return (
    <form key={JSON.stringify(values)} action={action} className="grid gap-4 sm:grid-cols-2">
      {Object.entries(shown).map(([name, value]) => (
        <input key={name} type="hidden" name={`shown.${name}`} value={value} />
      ))}
      <Field label="Status">
        <select name="status" defaultValue={values.status} className={input}>
          {choices.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </Field>
      <Field label="First answer on">
        <input
          type="date"
          name="answeredOn"
          required={application.answeredOn !== null}
          defaultValue={values.answeredOn}
          className={input}
        />
      </Field>
      <Field label="Notes" wide>
        <textarea name="notes" rows={4} defaultValue={values.notes} className={input} />
      </Field>
      <input type="hidden" name="version" value={application.version} />
      <Fields values={values} choosing={false} />
      <div className="flex flex-col items-start gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className={submit}>
          Save
        </button>
        <Failure failure={state?.failure ?? null} />
      </div>
    </form>
  );
}

export function UndoForm({
  code,
  version,
  undoTo,
}: {
  code: string;
  version: number;
  undoTo: Status;
}) {
  const [failure, action, pending] = useActionState<string | null, FormData>(
    undoStatus.bind(null, code),
    null,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="version" value={version} />
      <button type="submit" disabled={pending} className={`${pill} disabled:opacity-50`}>
        Undo the last move, back to {undoTo}
      </button>
      <Failure failure={failure} />
    </form>
  );
}
