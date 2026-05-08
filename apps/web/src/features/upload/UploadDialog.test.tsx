import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UploadDialog } from './UploadDialog.js';

// Helper: simulate a file-input change event in jsdom (no DataTransfer needed).
function changeInput(input: HTMLInputElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

afterEach(cleanup);

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <UploadDialog />
    </QueryClientProvider>,
  );
}

describe('UploadDialog — client-side MIME type validation', () => {
  it('shows a rejection message when a file with an unsupported MIME type is dropped', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Before the dialog opens, the trigger is the only "Upload" button.
    await user.click(screen.getByRole('button', { name: /^Upload$/i }));

    // Confirm the dialog opened.
    expect(await screen.findByText('Upload assets')).toBeTruthy();

    // The hidden file input rendered by react-dropzone.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    // Simulate a change event with an unsupported MIME type.
    // fireEvent.change with { target: { files } } bypasses the OS picker's
    // accept filter so the file reaches react-dropzone, which validates and rejects it.
    const unsupportedFile = new File(['content'], 'data.csv', { type: 'text/csv' });
    changeInput(input, [unsupportedFile]);

    await waitFor(() =>
      expect(
        screen.getByText(/only JPEG, PNG, WebP, GIF, MP4, MOV, WebM, and PDF/i),
      ).toBeTruthy(),
    );
  });

  it('does not show a rejection message when a supported MIME type is dropped', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /^Upload$/i }));
    await screen.findByText('Upload assets');

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const jpegFile = new File(['jpeg-data'], 'photo.jpg', { type: 'image/jpeg' });
    changeInput(input, [jpegFile]);

    // File should appear in the queued list, not in a rejection message.
    await waitFor(() => expect(screen.getByText('photo.jpg')).toBeTruthy());
    expect(screen.queryByText(/only JPEG/i)).toBeNull();
  });
});
