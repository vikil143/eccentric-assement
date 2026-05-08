import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-7xl font-bold tracking-tighter text-muted-foreground/30">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-2 text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
      >
        Back to assets
      </Link>
    </div>
  );
}
