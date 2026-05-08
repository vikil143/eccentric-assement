import { useState, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import { Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTheme } from '@/hooks/useTheme';
import { UploadDialog } from '@/features/upload/UploadDialog';

export function Layout() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Read from URL once on mount; the input is the source of truth from then on.
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') ?? '');
  const debouncedQ = useDebouncedValue(inputValue, 400);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    setSearchParams(
      (prev) => {
        if (debouncedQ) {
          prev.set('q', debouncedQ);
        } else {
          prev.delete('q');
        }
        return prev;
      },
      { replace: true },
    );
  }, [debouncedQ, setSearchParams]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex flex-wrap items-center gap-x-4 gap-y-2 py-2 md:h-14 md:flex-nowrap md:py-0">
          <span className="shrink-0 text-lg font-semibold tracking-tight">Marketing Assets</span>

          <div className="relative order-last w-full md:order-none md:max-w-sm md:flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search assets"
              placeholder="Search assets…"
              className="pl-8"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggle}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <UploadDialog />
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
