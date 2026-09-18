import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, ErrorNote, Field, Panel, TextInput } from '@/components/ui';

export interface OwnerSignInProps {
  onClose: () => void;
}

/**
 * Sign in as the owner, by a code sent to the owner's email.
 *
 * No password: the account Neon's console creates has none, and a library with
 * exactly one reader gains nothing from one. No sign-up either, because an
 * account anyone can create turns a personal library into a shared one by
 * accident.
 */
export const OwnerSignIn = ({ onClose }: OwnerSignInProps) => {
  const busy = useAuthStore((state) => state.busy);
  const error = useAuthStore((state) => state.error);
  const codeSent = useAuthStore((state) => state.codeSent);
  const requestCode = useAuthStore((state) => state.requestCode);
  const submitCode = useAuthStore((state) => state.submitCode);
  const reset = useAuthStore((state) => state.reset);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  // Reopening the form should ask from the start, not sit waiting for a code
  // that was requested minutes ago and has very likely expired.
  useEffect(() => reset, [reset]);

  const trimmedEmail = email.trim();
  const ready = codeSent ? code.trim().length > 0 : trimmedEmail.length > 0;

  const handleSubmit = async () => {
    if (!ready || busy) return;
    if (codeSent) {
      if (await submitCode(trimmedEmail, code.trim())) onClose();
      return;
    }
    await requestCode(trimmedEmail);
  };

  return (
    <Panel
      title="Sign in"
      subtitle={
        codeSent
          ? 'Check your email for a one-time code.'
          : 'Only the owner can change what is on these shelves.'
      }
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

        {codeSent ? (
          <Field label="Code" hint={`Sent to ${trimmedEmail}`}>
            <TextInput
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => {
                clearError();
                setCode(event.target.value);
              }}
            />
          </Field>
        ) : (
          <Field label="Email">
            <TextInput
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                clearError();
                setEmail(event.target.value);
              }}
            />
          </Field>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={codeSent ? reset : onClose}>
            {codeSent ? 'Use another email' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" disabled={!ready || busy}>
            {busy ? 'Working…' : codeSent ? 'Sign in' : 'Email me a code'}
          </Button>
        </div>
      </form>
    </Panel>
  );
};
