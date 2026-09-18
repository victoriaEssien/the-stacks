import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BookDetails } from '@/models';
import { BookDetailsForm } from '../BookDetailsForm';

const BOOK = {
  title: 'A Quiet Inventory',
  authors: ['Someone Else'],
  coverImage: 'https://books.google.com/books/content?id=abc&img=1',
};

const renderForm = (overrides: Partial<Parameters<typeof BookDetailsForm>[0]> = {}) => {
  const onSubmit = vi.fn<(details: BookDetails) => void>();
  render(<BookDetailsForm book={BOOK} onSubmit={onSubmit} onCancel={() => {}} {...overrides} />);
  // `Field` wraps its child in a <label>, so the accessible name carries the
  // hint text as well - hence a pattern rather than the exact label.
  const field = screen.getByLabelText(/cover image url/i) as HTMLInputElement;
  const submit = screen.getByRole('button', { name: /add to library/i });
  return { onSubmit, field, submit };
};

/**
 * The escape hatch for a book no provider has art for. Worth testing because
 * both of its states matter: a pasted URL must reach the store, and an EMPTY
 * box must mean "no cover" rather than "leave whatever the provider guessed".
 */
describe('BookDetailsForm cover field', () => {
  it('starts from the art the book already has, so it can be seen and corrected', () => {
    const { field } = renderForm();
    expect(field.value).toBe(BOOK.coverImage);
  });

  it('hands a pasted cover back on submit', () => {
    const { onSubmit, field, submit } = renderForm();
    fireEvent.change(field, { target: { value: 'https://example.com/my-scan.jpg' } });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ coverImage: 'https://example.com/my-scan.jpg' }),
    );
  });

  it('previews the pasted art immediately, so a wrong URL is obvious', () => {
    const { field } = renderForm();
    fireEvent.change(field, { target: { value: 'https://example.com/my-scan.jpg' } });
    expect(screen.getByAltText(`Cover of ${BOOK.title}`).getAttribute('src')).toBe(
      'https://example.com/my-scan.jpg',
    );
  });

  it('reads an emptied box as no cover at all', () => {
    const { onSubmit, field, submit } = renderForm();
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ coverImage: undefined }));
  });

  it('does not store the whitespace someone pasted around a URL', () => {
    const { onSubmit, field, submit } = renderForm();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ coverImage: undefined }));
  });

  it('prefers an existing edit over the provider, when reopened for editing', () => {
    const { field } = renderForm({
      initial: { status: 'read', coverImage: 'https://example.com/chosen.jpg' },
    });
    expect(field.value).toBe('https://example.com/chosen.jpg');
  });
});

/**
 * A cover from a host the proxy will not fetch still shows in the panel and in
 * Shelf view, because those are plain `<img>` tags. The room cannot show it.
 * That asymmetry has to be visible in the form, or it looks like a bug later.
 */
describe('BookDetailsForm cover host warning', () => {
  it('names the host the room cannot load from', () => {
    const { field } = renderForm();
    fireEvent.change(field, { target: { value: 'https://i.imgur.com/abc.jpg' } });
    expect(screen.getByText(/i\.imgur\.com/)).toBeTruthy();
    expect(screen.getByText(/shelf will draw a cover/i)).toBeTruthy();
  });

  it('says nothing for a host the room can load from', () => {
    const { field } = renderForm();
    fireEvent.change(field, {
      target: { value: 'https://m.media-amazon.com/images/I/abc.jpg' },
    });
    expect(screen.queryByText(/shelf will draw a cover/i)).toBeNull();
  });

  it('does not complain part way through typing a URL', () => {
    const { field } = renderForm();
    for (const partial of ['h', 'https:/', 'https://boo']) {
      fireEvent.change(field, { target: { value: partial } });
      expect(screen.queryByText(/shelf will draw a cover/i), partial).toBeNull();
    }
  });
});
