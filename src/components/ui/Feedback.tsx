import type { ReactNode } from 'react';

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
  <span className="inline-flex items-center gap-2 text-sm text-parchment-dim" role="status">
    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-500 border-t-brass" />
    {label}
  </span>
);

export const EmptyState = ({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) => (
  <div className="rounded-md border border-dashed border-ink-500 px-4 py-8 text-center">
    <p className="font-serif text-lg text-parchment">{title}</p>
    {body && <p className="mx-auto mt-1 max-w-sm text-sm text-parchment-dim">{body}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const ErrorNote = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div
    role="alert"
    className="flex items-center justify-between gap-3 rounded-md border border-ember/50 bg-ember/10 px-3 py-2 text-sm text-parchment"
  >
    <span>{message}</span>
    {onRetry && (
      <button type="button" className="shrink-0 underline hover:text-brass" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

/** Covers the room while the library is still being read from storage. */
export const LoadingVeil = ({ message = 'Opening the library…' }: { message?: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-900 text-parchment"
  >
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-500 border-t-brass" />
    <p className="font-serif text-lg">{message}</p>
  </div>
);

/** A quiet, self-dismissing confirmation. Never blocks anything. */
export const Toast = ({ message }: { message: string }) => (
  <div
    role="status"
    aria-live="polite"
    className="pointer-events-none rounded-full border border-brass/40 bg-ink-800/90 px-4 py-2 text-sm text-parchment shadow-lg shadow-black/40 backdrop-blur-sm"
  >
    {message}
  </div>
);
