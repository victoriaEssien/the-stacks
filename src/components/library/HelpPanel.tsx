import type { NavigationScheme } from '@/three';
import { Panel } from '@/components/ui';

export interface HelpPanelProps {
  /** Which set of controls the reader actually has. */
  navigation?: NavigationScheme;
  onClose: () => void;
}

const POINTER_CONTROLS: [string, string][] = [
  ['Click the room', 'Hand the mouse to the library'],
  ['Move the mouse', 'Look around — up and down as well as left and right'],
  ['W A S D / arrows', 'Walk'],
  ['Click a book', 'Open what you wrote about it'],
  ['Click the mailbox', 'Read and leave suggestions'],
  ['Esc', 'Release the mouse, or close a panel'],
];

const TOUCH_CONTROLS: [string, string][] = [
  ['Drag', 'Look around from where you are standing'],
  ['Tap the floor', 'Walk over to that spot'],
  ['Tap a book', 'Open what you wrote about it'],
  ['Tap the mailbox', 'Read and leave suggestions'],
  ['Pinch', 'Lean in, to read a cover without walking into the shelf'],
];

/** What the room does, for anyone who would rather be told than guess. */
export const HelpPanel = ({ navigation = 'pointer-lock', onClose }: HelpPanelProps) => (
  <Panel
    title="Finding your way"
    subtitle="The library is small. Nothing here is hidden."
    onClose={onClose}
  >
    <dl className="space-y-3">
      {(navigation === 'touch' ? TOUCH_CONTROLS : POINTER_CONTROLS).map(([keys, what]) => (
        <div key={keys} className="flex items-baseline gap-4">
          <dt className="w-28 shrink-0 text-sm text-brass sm:w-40">{keys}</dt>
          <dd className="text-sm text-parchment-dim">{what}</dd>
        </div>
      ))}
    </dl>

    <p className="mt-6 border-t border-ink-600 pt-4 text-sm leading-relaxed text-parchment-dim">
      Books you have finished stand on the shelves. What you are reading now sits on the desk. If
      walking around is not for you, switch to list view - everything is reachable there too.
    </p>
  </Panel>
);
