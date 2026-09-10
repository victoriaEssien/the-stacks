import type { NewBook } from '@/models';

/**
 * Optional demo data for developing the 3D layout without hitting the API.
 * Nothing imports this by default - call `seedLibrary()` from the console.
 *
 * These are placeholders, not a hard-coded reading list.
 */
const PLACEHOLDER_TITLES = [
  'The Long Afternoon',
  'Notes on a Quiet Year',
  'Cartography of Small Rooms',
  'Winter Arithmetic',
  'The Glasshouse Letters',
  'An Atlas of Borrowed Light',
];

export const placeholderBooks = (count = PLACEHOLDER_TITLES.length): NewBook[] =>
  Array.from({ length: count }, (_, index) => ({
    title: PLACEHOLDER_TITLES[index % PLACEHOLDER_TITLES.length]!,
    authors: ['Placeholder Author'],
    pageCount: 180 + ((index * 47) % 320),
    status: 'read' as const,
    source: 'seed',
    sourceId: `seed-${index}`,
  }));
