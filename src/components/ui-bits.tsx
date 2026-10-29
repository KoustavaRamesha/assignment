import { useEffect, useState } from 'react';
import { Card } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';
import { AlertTriangle } from 'lucide-react';

export const fmt = (n: number | null | undefined, d = 0) => (n == null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const hhmm = (iso: string) => iso.slice(11, 16);
export const dateTime = (iso: string) => `${iso.slice(8, 10)} ${['Dec', 'Jan', 'Feb'][Number(iso.slice(5, 7)) === 12 ? 0 : Number(iso.slice(5, 7))]} ${iso.slice(11, 16)}`;

export function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-2xl font-extrabold mt-1 font-mono">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setError(null);
    fn().then((d) => live && setData(d)).catch((e) => live && setError(e?.message ?? 'Failed to load'));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error };
}

export function Loading() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-80" />
      <p className="text-xs text-muted-foreground">First load fetches all January data from Elexon — this can take ~20 seconds.</p>
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return <Card className="p-4 flex gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{msg}</Card>;
}
