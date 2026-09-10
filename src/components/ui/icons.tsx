import type { ReactNode } from 'react';

/**
 * The icon set, drawn inline rather than loaded.
 *
 * Text glyphs were the first attempt and they do not hold up in a bar: `☰`,
 * `✉` and `★` come from different parts of the font with different weights and
 * optical sizes, so a row of them never lines up. These share a stroke width
 * and a 24-unit box, take their colour from the text around them, and cost no
 * request - which keeps the repo asset-free the same way the room's textures do.
 */
const Icon = ({
  children,
  className = 'h-5.5 w-5.5',
}: {
  children: ReactNode;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    {children}
  </svg>
);

export type IconProps = { className?: string };

/** Books on a shelf, one leaning. The library itself. */
export const BooksIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4" width="4.2" height="16" rx="1" />
    <rect x="8.6" y="4" width="4.2" height="16" rx="1" />
    <path d="M16.1 5.6l3.7 1-2.8 14.2-3.7-1z" />
  </Icon>
);

/** The suggestion box. */
export const MailIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 7.2L12 13l8.5-5.8" />
  </Icon>
);

/** The reading tally. */
export const StarIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.6l2.6 5.4 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.9l5.9-.9z" />
  </Icon>
);

/** Add a book. */
export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5.2v13.6M5.2 12h13.6" />
  </Icon>
);

export const HelpIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M9.4 9.3a2.7 2.7 0 113.5 2.6c-.6.2-.9.7-.9 1.3v.5" />
    <path d="M12 17.1h.01" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" />
  </Icon>
);
