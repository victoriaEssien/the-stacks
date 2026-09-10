export interface StarRatingProps {
  value?: number;
  onChange?: (value: number | undefined) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}

const STARS = [1, 2, 3, 4, 5];

export const StarRating = ({ value, onChange, readOnly = false, size = 'md' }: StarRatingProps) => {
  const textSize = size === 'sm' ? 'text-base' : 'text-2xl';

  if (readOnly) {
    return (
      <span className={`${textSize} text-brass`} aria-label={value ? `${value} of 5` : 'Unrated'}>
        {STARS.map((star) => (
          <span key={star}>{(value ?? 0) >= star ? '★' : '☆'}</span>
        ))}
      </span>
    );
  }

  return (
    // Each star carries a thumb-sized hit area; the glyph itself stays small.
    <div className={`flex ${textSize}`} role="radiogroup" aria-label="Rating">
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className="flex min-h-11 min-w-9 items-center justify-center text-brass transition-transform hover:scale-110"
          onClick={() => onChange?.(value === star ? undefined : star)}
        >
          {(value ?? 0) >= star ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
};
