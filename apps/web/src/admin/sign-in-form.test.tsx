import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { signIn } from './actions';
import { SignInForm } from './sign-in-form';

const actions = vi.hoisted(() => ({ signIn: vi.fn<typeof signIn>() }));

vi.mock('./actions', () => actions);

describe('SignInForm', () => {
  it('shows why the sign-in failed under the button', async () => {
    actions.signIn.mockResolvedValue('This link has expired or was already used.');
    render(<SignInForm />);
    expect(screen.queryByRole('alert')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link has expired or was already used.',
    );
    expect(actions.signIn).toHaveBeenCalledOnce();
  });
});
