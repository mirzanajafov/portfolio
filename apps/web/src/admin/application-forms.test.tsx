import { anApplicationPage } from '@portfolio/content/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { addApplication, editApplication, undoStatus } from './actions';
import { AddApplicationForm, EditApplicationForm, UndoForm } from './application-forms';

const actions = vi.hoisted(() => ({
  addApplication: vi.fn<typeof addApplication>(),
  editApplication: vi.fn<typeof editApplication>(),
  undoStatus: vi.fn<typeof undoStatus>(),
}));

vi.mock('./actions', () => actions);

const optionsOf = (name: string) =>
  within(screen.getByRole('combobox', { name }))
    .getAllByRole('option')
    .map(({ textContent }) => textContent);

describe('AddApplicationForm', () => {
  it('asks for the channel instead of choosing one, and needs every field the API needs', () => {
    render(<AddApplicationForm />);

    expect(screen.getByRole('combobox', { name: 'Channel' })).toHaveValue('');
    expect(optionsOf('Channel')).toEqual(['Choose one', 'referral', 'direct', 'recruiter']);
    for (const name of ['Company', 'Role', 'CV variant']) {
      expect(screen.getByRole('textbox', { name })).toBeRequired();
    }
    expect(screen.getByRole('combobox', { name: 'Channel' })).toBeRequired();
    expect(screen.getByLabelText('Applied on')).toBeRequired();
    expect(screen.getByRole('textbox', { name: 'City' })).not.toBeRequired();
  });

  it('shows why the API refused it under the button', async () => {
    actions.addApplication.mockResolvedValue('appliedOn 2026-11-07 is after today in Baku');
    render(<AddApplicationForm />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Company' }), 'Acme');
    await userEvent.type(screen.getByRole('textbox', { name: 'Role' }), 'Backend Engineer');
    await userEvent.type(screen.getByLabelText('Applied on'), '2026-11-07');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Channel' }), 'direct');
    await userEvent.type(screen.getByRole('textbox', { name: 'CV variant' }), 'base');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'appliedOn 2026-11-07 is after today in Baku',
    );
  });
});

describe('EditApplicationForm', () => {
  it('offers only the status it has and the ones it can move to, and fills in what it holds', () => {
    render(
      <EditApplicationForm
        application={anApplicationPage({
          status: 'interview',
          answeredOn: '2026-11-02',
          notes: 'Called back',
          city: 'Baku',
          networks: ['ACME-NET', 'ACME-VPN'],
        })}
      />,
    );

    expect(optionsOf('Status')).toEqual(['interview', 'offer', 'rejected', 'withdrawn']);
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('interview');
    expect(optionsOf('Channel')).toEqual(['referral', 'direct', 'recruiter']);
    expect(screen.getByLabelText('First answer on')).toHaveValue('2026-11-02');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Called back');
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveValue('Baku');
    expect(
      screen.getByRole('textbox', { name: 'Networks the company runs, one per line' }),
    ).toHaveValue('ACME-NET\nACME-VPN');
  });

  it('leaves a final status with nowhere to go', () => {
    render(<EditApplicationForm application={anApplicationPage({ status: 'rejected' })} />);

    expect(optionsOf('Status')).toEqual(['rejected']);
  });
});

describe('UndoForm', () => {
  it('says where an undo goes, and why it could not', async () => {
    actions.undoStatus.mockResolvedValue('there is no status change to undo');
    render(<UndoForm code="memh" undoTo="sent" />);

    await userEvent.click(screen.getByRole('button', { name: 'Undo the last move, back to sent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('there is no status change to undo');
    expect(actions.undoStatus).toHaveBeenCalledWith('memh', null, expect.any(FormData));
  });
});
