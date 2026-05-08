import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { Asset, AssetListResponse } from '@asset-manager/shared';
import { AssetsPage } from './AssetsPage.js';

const MOCK_ASSET: Asset = {
  id: 'asset-1',
  filename: 'hero.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 45_678,
  kind: 'image',
  url: 'https://res.cloudinary.com/demo/image/upload/hero.jpg',
  tags: ['brand'],
  uploadedAt: '2024-06-15T10:00:00.000Z',
  cloudinaryPublicId: 'marketing/hero',
};

const emptyResponse: AssetListResponse = { items: [], total: 0, page: 1, pageSize: 24 };
const populatedResponse: AssetListResponse = { items: [MOCK_ASSET], total: 1, page: 1, pageSize: 24 };

const server = setupServer(
  http.get('/api/assets', () => HttpResponse.json(emptyResponse)),
  http.get('/api/assets/tags', () => HttpResponse.json({ tags: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AssetsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AssetsPage', () => {
  it('shows loading skeletons while the query is in flight', () => {
    server.use(
      http.get('/api/assets', async () => {
        await delay('infinite');
        return HttpResponse.json(emptyResponse);
      }),
      http.get('/api/assets/tags', async () => {
        await delay('infinite');
        return HttpResponse.json({ tags: [] });
      }),
    );
    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows "No assets yet" when the list is empty', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('No assets yet')).toBeTruthy());
    expect(screen.getByText(/upload your first asset to get started/i)).toBeTruthy();
  });

  it('shows an error message and retry button when the query fails', async () => {
    server.use(
      http.get('/api/assets', () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/something went wrong while loading assets/i)).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('renders asset filenames when the list is populated', async () => {
    server.use(
      http.get('/api/assets', () => HttpResponse.json(populatedResponse)),
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('hero.jpg')).toBeTruthy());
  });
});
