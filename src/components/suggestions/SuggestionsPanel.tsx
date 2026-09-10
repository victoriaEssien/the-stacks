import { useState } from 'react';
import type { SuggestionStatus } from '@/models';
import { useSuggestionStore } from '@/stores/suggestionStore';
import {
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Panel,
  TextArea,
  TextInput,
  type PanelPlacement,
} from '@/components/ui';

export interface SuggestionsPanelProps {
  /** `screen` on touch, where this is a tab rather than something that opened. */
  placement?: PanelPlacement;
  onClose: () => void;
}

const NEXT_STATUS: Record<SuggestionStatus, SuggestionStatus> = {
  unread: 'considering',
  considering: 'added',
  added: 'dismissed',
  dismissed: 'unread',
};

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  unread: 'New',
  considering: 'Considering',
  added: 'Added',
  dismissed: 'Dismissed',
};

/** The suggestion box, opened: drop a note in, or read what is already inside. */
export const SuggestionsPanel = ({ placement, onClose }: SuggestionsPanelProps) => {
  const suggestions = useSuggestionStore((state) => state.suggestions);
  const addSuggestion = useSuggestionStore((state) => state.addSuggestion);
  const setStatus = useSuggestionStore((state) => state.setStatus);
  const removeSuggestion = useSuggestionStore((state) => state.removeSuggestion);
  const error = useSuggestionStore((state) => state.error);

  const [form, setForm] = useState({ title: '', author: '', note: '' });
  const [justAdded, setJustAdded] = useState(false);

  const submit = async () => {
    const title = form.title.trim();
    if (!title) return;
    const created = await addSuggestion({
      title,
      author: form.author.trim() || undefined,
      note: form.note.trim() || undefined,
    });
    if (created) {
      setForm({ title: '', author: '', note: '' });
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2200);
    }
  };

  return (
    <Panel
      title="Suggestion box"
      subtitle="Leave a note about something worth reading."
      placement={placement}
      onClose={onClose}
    >
      {error && (
        <div className="mb-4">
          <ErrorNote message={error.message} />
        </div>
      )}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label="Book title">
          <TextInput
            autoFocus
            required
            value={form.title}
            placeholder="What should I read?"
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
          />
        </Field>
        <Field label="Author" hint="Optional">
          <TextInput
            value={form.author}
            onChange={(event) => setForm((prev) => ({ ...prev, author: event.target.value }))}
          />
        </Field>
        <Field label="Note" hint="Optional">
          <TextArea
            value={form.note}
            placeholder="Why this one?"
            onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
          />
        </Field>
        <div className="flex items-center justify-end gap-3">
          {justAdded && <span className="text-sm text-brass">Slipped into the box.</span>}
          <Button type="submit" variant="primary" disabled={!form.title.trim()}>
            Submit suggestion
          </Button>
        </div>
      </form>

      <hr className="my-6 border-ink-600" />

      <h3 className="mb-3 font-serif text-lg text-parchment">
        Inside the box{suggestions.length > 0 ? ` (${suggestions.length})` : ''}
      </h3>

      {suggestions.length === 0 ? (
        <EmptyState title="Empty for now" body="Suggestions you drop in will pile up here." />
      ) : (
        <ul className="space-y-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="rounded-md border border-ink-600 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-serif text-parchment">{suggestion.title}</p>
                  {suggestion.author && (
                    <p className="text-sm text-parchment-dim">{suggestion.author}</p>
                  )}
                  {suggestion.note && (
                    <p className="mt-1 text-sm text-parchment-dim/85">{suggestion.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-ink-500 px-2 py-1 text-xs text-parchment-dim hover:border-brass hover:text-brass"
                    onClick={() => void setStatus(suggestion.id, NEXT_STATUS[suggestion.status])}
                  >
                    {STATUS_LABEL[suggestion.status]}
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${suggestion.title}`}
                    className="px-1.5 text-parchment-dim hover:text-ember"
                    onClick={() => void removeSuggestion(suggestion.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};
