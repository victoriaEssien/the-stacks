import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, ErrorNote, Field, Panel, TextInput } from '@/components/ui';

export interface OwnerSignInProps {
  onClose: () => void;
}

/**
 * Sign in as the owner, so the library can be changed.
 *
 * There is deliberately no sign-up here. One account exists, created in the
 * Neon console; an account anyone can create is an account that turns a
 * personal library into a shared one by accident.
 */
export const OwnerSignIn = ({ onClose }: OwnerSignInProps) => {
  const busy = useAuthStore((state) => state.busy);
  const error = useAuthStore((state) => state.error);
  const submit = useAuthStore((state) => state.signIn);
  const clearError = useAuthStore((state) => state.clearError);

  const [form, setForm] = useState({ email: '', password: '' });
  const ready = form.email.trim().length > 0 && form.password.length > 0;

  const handleSubmit = async () => {
    if (!ready || busy) return;
    if (await submit(form.email.trim(), form.password)) onClose();
  };

  return (
    <Panel
      title="Sign in"
      subtitle="Only the owner can change what is on these shelves."
      onClose={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        {error && <ErrorNote message={error.message} />}

        <Field label="Email">
          <TextInput
            autoFocus
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => {
              clearError();
              setForm((prev) => ({ ...prev, email: event.target.value }));
            }}
          />
        </Field>

        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(event) => {
              clearError();
              setForm((prev) => ({ ...prev, password: event.target.value }));
            }}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </Panel>
  );
};
