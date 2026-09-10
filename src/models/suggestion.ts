import type { IsoDate } from './book';

export const SUGGESTION_STATUSES = ['unread', 'considering', 'added', 'dismissed'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export interface Suggestion {
  id: string;
  title: string;
  author?: string;
  note?: string;
  status: SuggestionStatus;
  createdAt: IsoDate;
}

export type NewSuggestion = Pick<Suggestion, 'title'> &
  Partial<Pick<Suggestion, 'author' | 'note'>>;

export const isSuggestionStatus = (value: unknown): value is SuggestionStatus =>
  typeof value === 'string' && (SUGGESTION_STATUSES as readonly string[]).includes(value);

export const isSuggestion = (value: unknown): value is Suggestion => {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Partial<Suggestion>;
  return typeof s.id === 'string' && typeof s.title === 'string' && isSuggestionStatus(s.status);
};
