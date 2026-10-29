import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@project/components/ui/button';
import { Card } from '@project/components/ui/card';
import { Badge } from '@project/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { DAILY, HOURLY, PRESET_METRICS } from '../content/reportData';

const V = () => <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Verified</Badge>;
const E = () => <Badge variant="outline" className="text-[10px] px-1.5 py-0">Estimate</Badge>;

function Kpi({ label, value, note, tag }: { label: string; value: string; note: string; tag: 'v' | 'e' }) {
  return (
    <Card className="p-4">
      <div className="flex justify-between items-start gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>{tag === 'v' ? <V /> : <E />}</div>
      <div className="text-2xl font-extrabold font-mono mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{note}</div>
    </Card>
  );
}

const views = {
  energy: { title: 'Daily wind energy — forecast vs actual (GWh)', bars: [['fc', 'Forecast', 1], ['act', 'Actual', 2]], line: null },
  error: { title: 'Daily average miss (MAE) and bias (MW)', bars: [['mae', 'MAE', 1]], line: ['bias', 'Bias', 3] },
  demand: { title: 'GB demand vs actual wind (GWh)', bars: [['dem', 'Demand', 3], ['act', 'Wind', 2]], line: null },
  prices: { title: 'Daily avg price — day-ahead vs imbalance (£/MWh)', bars: [], line: null },
} as const;
type View = keyof typeof views;

function DailyChart() {
  const [v, setV] = useState<View>('energy');
  const cfg = views[v];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
        <div className="font-semibold text-sm">{cfg.title}</div>
        <Tabs value={v} onValueChange={(x) => setV(x as View)}><TabsList className="h-8">
          {(['energy', 'error', 'demand', 'prices'] as View[]).map((k) => <TabsTrigger key={k} value={k} className="text-xs capitalize">{k}</TabsTrigger>)}
        </TabsList></Tabs>
      </div>
      <div className="h-72"><ResponsiveContainer>
        <ComposedChart data={DAILY}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} />
          <Tooltip labelFormatter={(d) => `${d} January 2026`} formatter={(x: number) => x.toLocaleString('en-GB')} />
          <Legend />
          {cfg.bars.map(([k, n, c]) => <Bar key={k} dataKey={k} name={n} fill={`hsl(var(--chart-${c}))`} radius={[3, 3, 0, 0]} />)}
          {cfg.line && <Line dataKey={cfg.line[0]} name={cfg.line[1]} stroke={`hsl(var(--chart-${cfg.line[2]}))`} dot={false} strokeWidth={2} />}
          {v === 'prices' && <Line dataKey="mid" name="Day-ahead (MID)" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />}
          {v === 'prices' && <Line dataKey="sip" name="Imbalance" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

function HourlyChart() {
  return (
    <Card className="p-4">
      <div className="font-semibold text-sm mb-1">Error by delivery hour (MW)</div>
      <p className="text-xs text-muted-foreground mb-3">Worst overnight (03:00–06:00). Error doesn't grow with lead time, so the issue is structural.</p>
      <div className="h-60"><ResponsiveContainer>
        <ComposedChart data={HOURLY}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="hour" fontSize={10} interval={2} /><YAxis fontSize={11} />
          <Tooltip formatter={(x: number, n) => (n === 'Lead time (h)' ? `${x} h` : `${x.toLocaleString('en-GB')} MW`)} />
          <Bar dataKey="mae" name="MAE" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
          <Line dataKey="bias" name="Bias" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} />
          <Line dataKey="lead" name="Lead time (h)" hide />
        </ComposedChart>
      </ResponsiveContainer></div>
    </Card>
  );
}

function DeadlineCompare() {
  const [k, setK] = useState<keyof typeof PRESET_METRICS>('09:20');
  const m = PRESET_METRICS[k];
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3"><span className="font-semibold text-sm">Does a later deadline help?</span><V /></div>
      <div className="flex gap-2 mb-3">{(Object.keys(PRESET_METRICS) as (keyof typeof PRESET_METRICS)[]).map((p) => (
        <Button key={p} size="sm" variant={p === k ? 'default' : 'outline'} onClick={() => setK(p)}>{p}</Button>))}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['MAE', m.mae], ['RMSE', m.rmse], ['Bias', `+${m.bias}`], ['P90', m.p90], ['% error', `${m.pct}%`], ['Run used', m.run]].map(([l, x]) => (
          <div key={l} className="rounded-md bg-muted p-2"><div className="text-[11px] text-muted-foreground">{l}</div><div className="font-mono font-bold">{typeof x === 'number' ? x.toLocaleString('en-GB') : x}</div></div>))}
      </div>
      <p className="text-xs text-muted-foreground mt-3">Only slightly: 15:30 cuts MAE by 7.5%, but the bias barely moves.</p>
    </Card>
  );
}

function WorstDays() {
  const worst = [...DAILY].sort((a, b) => b.mae - a.mae).slice(0, 5);
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3"><span className="font-semibold text-sm">Biggest-miss days</span><V /></div>
      <div className="space-y-2">{worst.map((d) => (
        <div key={d.day} className="flex items-center gap-3 text-sm">
          <span className="w-14 font-semibold">{d.day} Jan</span>
          <div className="flex-1 h-2 rounded bg-muted"><div className="h-2 rounded bg-chart-2" style={{ width: `${(d.mae / 5329) * 100}%`, background: 'hsl(var(--chart-2))' }} /></div>
          <span className="font-mono w-20 text-right">{d.mae.toLocaleString('en-GB')} MW</span>
        </div>))}</div>
      <p className="text-xs text-muted-foreground mt-3">All over-forecasts. 28 Jan: 267 GWh forecast vs 138 GWh delivered.</p>
    </Card>
  );
}

export default function ReportPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">January 2026 at a glance</h2>
          <p className="text-sm text-muted-foreground">GB wind forecast (09:20 day-before) vs actual · Elexon BMRS data · national level</p>
        </div>
        <Button asChild><a href="/report/Wind_Report_January_2026.pdf" download><Download className="h-4 w-4 mr-2" />Download full report (PDF)</a></Button>
      </div>
      <Card className="p-4 bg-accent text-accent-foreground">
        <b>Bottom line:</b> the forecast promised ~16% more wind than arrived, almost every day. The cost of covering the gap was small this month (~£4m net), but the volume risk was large (~1.4 TWh).
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Forecast vs actual" value="+1.38 TWh" note="9.99 TWh forecast · 8.62 TWh delivered (+16%)" tag="e" />
        <Kpi label="Average miss (MAE)" value="2,128 MW" note="RMSE 2,606 · P90 4,313 · 18.4% error" tag="v" />
        <Kpi label="Bias" value="+1,852 MW" note="87% of the miss is steady over-forecasting" tag="v" />
        <Kpi label="Net cost of error" value="≈ £4.0m" note="£145m shortfall at imbalance vs day-ahead" tag="e" />
      </div>
      <DailyChart />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2"><HourlyChart /></div>
        <WorstDays />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <DeadlineCompare />
        <Card className="p-4 text-sm space-y-2">
          <div className="font-semibold">What to do</div>
          <p>1. <b>Correct for the lean:</b> subtract a rolling hourly bias before buying.</p>
          <p>2. <b>Extra cover on windy nights</b> (00:00–07:00, forecast above ~15 GW).</p>
          <p>3. <b>Use the 15:30 run</b> for any volume still adjustable.</p>
          <p>4. <b>Share trade &amp; settlement data</b> so the cost figures can become your actual costs.</p>
          <p className="text-xs text-muted-foreground pt-1">Not available: the utility's own purchases, contracts and balancing charges. Costs shown are GB-wide estimates.</p>
        </Card>
      </div>
    </div>
  );
}
