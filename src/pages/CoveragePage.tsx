import { getCoverage } from 'zitejs/api';
import { Card } from '@project/components/ui/card';
import { Progress } from '@project/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@project/components/ui/collapsible';
import { Table, TableBody, TableCell, TableRow } from '@project/components/ui/table';
import { AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { useLoad, Loading, ErrorBox, fmt, dateTime } from '../components/ui-bits';

type D = Awaited<ReturnType<typeof getCoverage>>;

function Funnel({ d, deadline }: { d: D; deadline: string }) {
  const steps = [
    { label: 'Half-hours in January', n: d.expected, why: '31 days × 48 half-hours' },
    { label: 'Have an actual wind reading', n: d.actualsFound, why: 'From Elexon FUELHH' },
    { label: 'Have any forecast', n: d.halfHoursWithAnyForecast, why: 'Forecasts are hourly, so :30 slots have none' },
    { label: `Have a forecast out before ${deadline}`, n: d.expected - d.noEligibleForecast, why: 'Published by the deadline the day before' },
    { label: 'Usable pairs (forecast + actual)', n: d.matchedPairs, why: 'What every accuracy number is based on' },
  ];
  return (
    <Card className="p-5">
      <div className="font-semibold">How much data survives each step</div>
      <p className="text-sm text-muted-foreground mb-4">We start with every half-hour in January and keep only those we can fairly compare.</p>
      <div className="space-y-3">{steps.map((s, i) => (
        <div key={s.label}>
          <div className="flex justify-between text-sm"><span className="font-medium">{i + 1}. {s.label}</span><span className="font-mono font-bold">{fmt(s.n)}</span></div>
          <Progress value={(s.n / d.expected) * 100} className="h-2 my-1" />
          <div className="text-xs text-muted-foreground">{s.why}</div>
        </div>))}</div>
    </Card>
  );
}

function Check({ ok, title, text }: { ok: boolean; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      {ok ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> : <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />}
      <div><div className="text-sm font-semibold">{title}</div><div className="text-xs text-muted-foreground">{text}</div></div>
    </div>
  );
}

function Schedule({ d, deadline }: { d: D; deadline: string }) {
  const pos = (t: string) => { const [h, m] = t.split(':').map(Number); return ((h * 60 + m) / 1440) * 100; };
  const regular = d.publishHoursUtc.filter((p) => p.count >= 20);
  return (
    <Card className="p-5">
      <div className="font-semibold">When Elexon publishes new forecasts</div>
      <p className="text-sm text-muted-foreground mb-6">Each dot is a daily forecast run. The buyer gets the last dot before the deadline line.</p>
      <div className="relative h-14 mx-2">
        <div className="absolute top-5 left-0 right-0 h-1 rounded bg-muted" />
        {regular.map((p) => (
          <div key={p.time} className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pos(p.time)}%`, top: 12 }}>
            <div className="h-4 w-4 rounded-full bg-chart-1" style={{ background: 'hsl(var(--chart-1))' }} />
            <span className="text-[10px] font-mono mt-1">{p.time}</span>
          </div>))}
        <div className="absolute -translate-x-1/2 flex flex-col items-center" style={{ left: `${pos(deadline)}%`, top: -14 }}>
          <span className="text-[10px] font-bold text-destructive">Deadline {deadline}</span>
          <div className="w-0.5 h-10 bg-destructive" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 mx-2"><span>00:00</span><span>12:00</span><span>24:00 UTC</span></div>
    </Card>
  );
}

export default function CoveragePage({ deadline }: { deadline: string }) {
  const { data: d, error } = useLoad(() => getCoverage({ deadline }), [deadline]);
  if (error) return <ErrorBox msg={error} />;
  if (!d) return <Loading />;
  const raw: [string, string][] = [
    ['Forecast rows downloaded', fmt(d.forecastRowsFetched)], ['February targets removed', fmt(d.februaryTrimmed)],
    ['Exact duplicates dropped', fmt(d.exactDuplicatesDropped)], ['Conflicting rows flagged', fmt(d.conflictsFlagged)],
    ['Forecast versions kept', fmt(d.forecastRowsKept)], ['Actual rows sharing a time', fmt(d.actualMultiples)],
    ['Longest lead time', `${fmt(d.maxLeadHours, 1)} h`], ['Earliest forecast for 1 Jan 00:00', d.earliestEligibleForJan1 ? dateTime(d.earliestEligibleForJan1) : '—'],
  ];
  return (
    <div className="space-y-5">
      <Card className="p-5 bg-accent text-accent-foreground">
        <div className="text-sm font-semibold">Can you trust the numbers?</div>
        <p className="text-sm mt-1">This page shows what data we got from Elexon, what we cleaned out, and how much was left to compare. <b>{fmt(d.matchedPairs)}</b> of {fmt(d.expected)} half-hours ({fmt(d.coveragePct, 1)}%) have both a forecast and an actual. That's the maximum possible, because forecasts are only published hourly.</p>
      </Card>
      <div className="grid lg:grid-cols-2 gap-5">
        <Funnel d={d} deadline={deadline} />
        <Card className="p-5 space-y-4">
          <div className="font-semibold">Data quality checks</div>
          <Check ok={d.actualsFound === d.expected} title="Every half-hour has an actual reading" text={`${fmt(d.actualsFound)} of ${fmt(d.expected)} found`} />
          <Check ok={d.conflictsFlagged === 0} title="No conflicting forecasts" text={`${d.conflictsFlagged} cases where the same version had two different values`} />
          <Check ok title="Duplicates removed" text={`${d.exactDuplicatesDropped} exact copies dropped; all distinct versions kept`} />
          <Check ok={d.windowOk} title="Download started early enough" text={`Forecasts can be made up to ${fmt(d.maxLeadHours, 0)} h ahead, so we fetched from 20 Dec to catch them all`} />
          <Check ok={d.noEligibleForecast - (d.expected - d.halfHoursWithAnyForecast) === 0} title="Every forecast hour had a version before the deadline" text={`${fmt(d.noEligibleForecast)} half-hours have no forecast — all are :30 slots`} />
        </Card>
      </div>
      <Schedule d={d} deadline={deadline} />
      <Collapsible>
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-primary"><ChevronDown className="h-4 w-4" />Technical details</CollapsibleTrigger>
        <CollapsibleContent><Card className="mt-2"><Table><TableBody>{raw.map(([k, v]) => (
          <TableRow key={k}><TableCell>{k}</TableCell><TableCell className="text-right font-mono">{v}</TableCell></TableRow>))}</TableBody></Table></Card></CollapsibleContent>
      </Collapsible>
    </div>
  );
}
