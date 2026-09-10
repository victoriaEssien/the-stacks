import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'quiet' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brass text-ink-900 hover:bg-brass-bright',
  ghost: 'border border-ink-500 text-parchment hover:border-brass hover:text-brass-bright',
  quiet: 'text-parchment-dim hover:text-parchment',
  danger: 'border border-ember/60 text-ember hover:bg-ember/10',
};

/**
 * `coarse:` widens the hit area on touch. A 34px-tall button is comfortable
 * under a cursor and a coin toss under a thumb, and the same button has to do
 * both jobs - so the size follows the pointer rather than the breakpoint.
 */
export const Button = ({ variant = 'ghost', className = '', children, ...rest }: ButtonProps) => (
  <button
    type="button"
    {...rest}
    className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 coarse:min-h-11 coarse:min-w-11 coarse:px-4 ${VARIANTS[variant]} ${className}`}
  >
    {children}
  </button>
);
