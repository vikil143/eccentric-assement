import { useParams } from 'react-router-dom';

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="text-muted-foreground text-sm">Asset detail for {id}</div>
  );
}
