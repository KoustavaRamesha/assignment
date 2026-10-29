import { useState } from 'react';
import { getVersions } from '../lib/client';
import { Card } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Skeleton } from '@project/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@project/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@project/components/ui/table';
import { CheckCircle2, ChevronDown, Clock, XCircle } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@project/components/lib/utils';
import DayPicker from '../components/DayPicker';
import { useLoad, ErrorBox, fmt, dateTime } from '../components/ui-bits';

type Data = Awaited<ReturnType<typeof getVersions>>;

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="h-7 w-7 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold">{n}</div>
      <div><div className="font-semibold text-sm">{title}</div><div className="text-sm text-muted-foreground">{children}</div></div>
    </div>
  );
}

function Verdict({ d }: { d: Data }) {
  const picked = d.versions.find((v) => v.picked);
  const latest = d.versions[d.versions.length - 1];
  const miss = (mw?: number) => (mw != null && d.actual != null ? mw - d.actual : null);
  const sign = (x: number | null) => (x == null ? '—' : `${x > 0 ? '+' : ''}${fmt(x)} MW`);
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="p-4 border-primary border-2">
        <div className="text-xs font-semibold uppercase text-primary">What the buyer had</div>
        <div className="text-2xl font-extrabold font-mono mt-1">{picked ? `${fmt(picked.mw)} MW` : 'None'}</div>
        <div className="text-xs text-muted-foreground mt-1">{picked ? `Published ${dateTime(picked.publishTime)} · ${fmt(picked.leadHours, 1)} h ahead · miss ${sign(miss(picked.mw))}` : 'No forecast was out before the deadline'}</div>
      </Card>
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase text-muted-foreground">What actually happened</div>
        <div className="text-2xl font-extrabold font-mono mt-1">{fmt(d.actual)} MW</div>
        <div className="text-xs text-muted-foreground mt-1">Metered wind output (FUELHH)</div>
      </Card>
      <Card className="p-4 bg-muted">
        <div className="text-xs font-semibold uppercase text-muted-foreground">The trap: latest forecast</div>
        <div className="text-2xl font-extrabold font-mono mt-1 text-muted-foreground line-through decoration-2">{fmt(latest?.mw)} MW</div>
        <div className="text-xs text-muted-foreground mt-1">{latest?.picked ? 'No newer version was published, so it matches what the buyer had.' : `Published ${latest ? dateTime(latest.publishTime) : '—'}, after the deadline, so the buyer never saw it · miss ${sign(miss(latest?.mw))}`}</div>
      </Card>
    </div>
  );
}

function EvolutionChart({ d }: { d: Data }) {
  const pts = d.versions.map((v) => ({ t: Date.parse(v.publishTime), mw: v.mw, picked: v.picked ? v.mw : null, label: dateTime(v.publishTime) }));
  const dl = Date.parse(d.deadline);
  return (
    <Card className="p-4">
      <div className="font-semibold text-sm">How the forecast for this hour changed over time</div>
      <p className="text-xs text-muted-foreground mb-3">Each dot is one forecast version. Left of the dashed line = available to the buyer; right = too late.</p>
      <div className="h-72"><ResponsiveContainer>
        <ComposedChart data={pts}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} fontSize={11} tickFormatter={(t) => dateTime(new Date(t).toISOString())} />
          <YAxis fontSize={11} domain={['auto', 'auto']} />
          <Tooltip labelFormatter={(t) => `Published ${dateTime(new Date(Number(t)).toISOString())}`} formatter={(x: number) => `${fmt(x)} MW`} />
          <ReferenceLine x={dl} stroke="hsl(var(--foreground))" strokeDasharray="6 4" label={{ value: 'Deadline', position: 'insideTopLeft', fontSize: 11 }} />
          {d.actual != null && <ReferenceLine y={d.actual} stroke="hsl(var(--chart-2))" strokeWidth={2} label={{ value: `Actual ${fmt(d.actual)}`, position: 'insideBottomRight', fontSize: 11, fill: 'hsl(var(--chart-2))' }} />}
          <Line dataKey="mw" name="Forecast" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
          <Scatter dataKey="picked" name="Picked" fill="hsl(var(--primary))" shape={(p: { cx?: number; cy?: number; payload?: { picked: number | null } }) => p.payload?.picked == null ? <g /> : <circle cx={p.cx} cy={p.cy} r={8} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />} />
        </ComposedChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

function VersionTable({ d }: { d: Data }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-1 text-sm font-semibold text-primary"><ChevronDown className="h-4 w-4" />Show all {d.versions.length} versions</CollapsibleTrigger>
      <CollapsibleContent><Card className="mt-2"><Table>
        <TableHeader><TableRow><TableHead>Published</TableHead><TableHead className="text-right">Forecast</TableHead><TableHead className="text-right">Hours ahead</TableHead><TableHead>Available at deadline?</TableHead></TableRow></TableHeader>
        <TableBody>{d.versions.map((v) => (
          <TableRow key={v.publishTime} className={cn(v.picked && 'bg-accent font-semibold', !v.eligible && 'text-muted-foreground')}>
            <TableCell className="font-mono">{dateTime(v.publishTime)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(v.mw)} MW</TableCell>
            <TableCell className="text-right font-mono">{fmt(v.leadHours, 1)}</TableCell>
            <TableCell>{v.picked ? <Badge><CheckCircle2 className="h-3 w-3 mr-1" />Yes — used</Badge> : v.eligible ? <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Yes, but older</span> : <span className="flex items-center gap-1"><XCircle className="h-3 w-3" />No, too late</span>}</TableCell>
          </TableRow>))}</TableBody>
      </Table></Card></CollapsibleContent>
    </Collapsible>
  );
}

export default function ProofPage({ deadline }: { deadline: string }) {
  const [day, setDay] = useState(12);
  const [hour, setHour] = useState(1);
  const { data, error } = useLoad(() => getVersions({ day, slot: hour * 2, deadline }), [day, hour, deadline]);
  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-lg font-extrabold">Which forecast did the buyer really have?</h2>
          <p className="text-sm text-muted-foreground">Elexon re-publishes the wind forecast for every hour many times. This page proves we use the one the buyer could actually see — not a later, better one.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Step n={1} title="Pick an hour">Choose a delivery day and hour below.</Step>
          <Step n={2} title="Apply the deadline">Only forecasts published by {deadline} the day before count.</Step>
          <Step n={3} title="Take the newest of those">That is what the buyer used. Later versions are ignored.</Step>
        </div>
        <div className="flex flex-wrap gap-3 pt-1">
          <DayPicker day={day} onChange={setDay} />
          <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>)}</SelectContent>
          </Select>
          {data && <span className="text-sm self-center text-muted-foreground">Deadline: <b className="text-foreground font-mono">{dateTime(data.deadline)}</b></span>}
        </div>
      </Card>
      {error ? <ErrorBox msg={error} /> : !data ? <Skeleton className="h-96" /> : data.versions.length === 0 ? <Card className="p-4 text-sm">No forecasts exist for this hour.</Card> : (
        <>
          <Verdict d={data} />
          <EvolutionChart d={data} />
          <VersionTable d={data} />
        </>
      )}
    </div>
  );
}
