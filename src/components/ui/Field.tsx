import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/**
 * `coarse:text-base` is not decoration: mobile Safari zooms the whole page in
 * when a field smaller than 16px takes focus, and never zooms back out, so a
 * 14px input turns the library into a magnified corner of itself.
 */
const BASE =
  'w-full rounded-md border border-ink-500 bg-ink-900/70 px-3 py-2 text-sm text-parchment placeholder:text-parchment-dim/60 focus:border-brass focus:outline-none coarse:min-h-11 coarse:text-base';

export interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

export const Field = ({ label, hint, children }: FieldProps) => (
  <label className="block space-y-1.5">
    <span className="text-xs font-medium uppercase tracking-wide text-parchment-dim">{label}</span>
    {children}
    {hint && <span className="block text-xs text-parchment-dim/70">{hint}</span>}
  </label>
);

export const TextInput = ({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={`${BASE} ${className}`} />
);

export const TextArea = ({
  className = '',
  rows = 3,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...rest} rows={rows} className={`${BASE} resize-y ${className}`} />
);
