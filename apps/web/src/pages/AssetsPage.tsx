import { useSearchParams } from 'react-router-dom';

export function AssetsPage() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q');

  return (
    <div className="text-muted-foreground text-sm">
      {q ? <>Showing results for &ldquo;{q}&rdquo;</> : 'All assets will appear here.'}
    </div>
  );
}
