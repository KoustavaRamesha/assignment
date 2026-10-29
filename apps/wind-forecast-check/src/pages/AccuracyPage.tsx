import { getAccuracy } from '../lib/client';
import { Card } from '@project/components/ui/card';
import { History } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tile, useLoad, Loading, ErrorBox, fmt } from '../components/ui-bits';

export default function AccuracyPage({ deadline }: { deadline: string }) {
  const { data, error } = useLoad(() => getAccuracy({ deadline }), [deadline]);
  if (error) return <ErrorBox msg={error} />;
  if (!data) return <Loading />;
  const o = data.overall;
  return (
    <div className="space-y-5">
      <Card className="p-4 bg-muted text-sm flex gap-2 items-center">
        <History className="h-4 w-4" /> Looking back at January. Not information the buyer had at the time.
      </Card>
      <p className="text-lg">
        With a {deadline} deadline, the forecast missed actual wind by <b>{fmt(o.mae)} MW</b> per half-hour on average
        ({fmt(o.nmae, 1)}% of average wind), and {o.bias != null && o.bias > 0 ? 'tended to promise too much' : 'tended to promise too little'} wind
        (bias {o.bias != null && o.bias > 0 ? '+' : ''}{fmt(o.bias)} MW).
      </p>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Tile label="Average miss (MAE)" value={`${fmt(o.mae)} MW`} />
        <Tile label="Bias" value={`${o.bias != null && o.bias > 0 ? '+' : ''}${fmt(o.bias)} MW`} sub="forecast − actual" />
        <Tile label="P90 error" value={`${fmt(o.p90)} MW`} sub="9 in 10 miss by less" />
        <Tile label="Normalised MAE" value={`${fmt(o.nmae, 1)}%`} sub="MAE ÷ mean actual" />
        <Tile label="Valid pairs" value={fmt(o.validPairs)} sub={`of ${data.expected} half-hours`} />
      </div>
      <p className="text-sm text-muted-foreground">Coverage: {fmt(o.validPairs)} of {data.expected} half-hours ({fmt((o.validPairs / data.expected) * 100, 1)}%) have both a forecast and an actual. Forecasts are hourly, so ~50% is the maximum possible.</p>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">Average miss per delivery day (MW)</div>
          <div className="h-72"><ResponsiveContainer>
            <BarChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip formatter={(v: number) => `${fmt(v)} MW`} labelFormatter={(d) => `${d} January`} />
              <Bar dataKey="mae" name="MAE" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </Card>
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2">Average miss by delivery hour (MW)</div>
          <div className="h-72"><ResponsiveContainer>
            <BarChart data={data.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" fontSize={11} /><YAxis fontSize={11} />
              <Tooltip content={({ active, payload }) => active && payload?.[0] ? (
                <div className="bg-card border rounded p-2 text-xs">
                  <div className="font-semibold">{String(payload[0].payload.hour).padStart(2, '0')}:00–:59</div>
                  <div>MAE {fmt(payload[0].payload.mae)} MW</div>
                  <div>Avg lead time {fmt(payload[0].payload.avgLead, 1)} h</div>
                </div>) : null} />
              <Bar dataKey="mae" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
          <p className="text-xs text-muted-foreground mt-2">Later delivery half-hours generally have a longer lead time. Lead time comes from the chosen records.</p>
        </Card>
      </div>
    </div>
  );
}
