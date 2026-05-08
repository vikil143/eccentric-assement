import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import { AssetsPage } from '@/pages/AssetsPage';
import { AssetDetailPage } from '@/pages/AssetDetailPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<AssetsPage />} />
          <Route path="assets/:id" element={<AssetDetailPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
