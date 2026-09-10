import type { Book } from '@/models';
import { computeStats } from '@/utils/stats';
import { Panel, type PanelPlacement } from '@/components/ui';

export interface ReadingStatsProps {
  books: Book[];
  /** `screen` on touch, where this is a tab rather than something that opened. */
  placement?: PanelPlacement;
  onClose: () => void;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md border border-ink-600 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-parchment-dim">{label}</p>
    <p className="font-serif text-2xl text-parchment">{value}</p>
  </div>
);

/**
 * Deliberately small. This is a library, not a productivity tracker - no
 * streaks, no quotas (spec section 19).
 */
export const ReadingStats = ({ books, placement, onClose }: ReadingStatsProps) => {
  const stats = computeStats(books);

  return (
    <Panel
      title="Your reading"
      subtitle="A quiet tally, nothing more."
      placement={placement}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Books read" value={String(stats.booksRead)} />
        <Stat label="This year" value={String(stats.booksThisYear)} />
        <Stat label="Pages" value={stats.pagesRead ? stats.pagesRead.toLocaleString() : '—'} />
        <Stat label="Average rating" value={stats.averageRating ? `${stats.averageRating}` : '—'} />
        <Stat label="Want to read" value={String(stats.wantToRead)} />
        <Stat
          label="Most read"
          value={stats.topAuthor ? stats.topAuthor.name.split(' ').slice(-1)[0]! : '—'}
        />
      </div>

      {stats.currentlyReading.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-parchment-dim">
            Currently reading
          </h3>
          <ul className="space-y-1">
            {stats.currentlyReading.map((book) => (
              <li key={book.id} className="font-serif text-parchment">
                {book.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Panel>
  );
};
