import { useState } from 'react';
import { getDay } from '../lib/client';
import { Card } from '@project/components/ui/card';
import DayPicker from '../components/DayPicker';
import { Info } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Tile, useLoad, Loading, ErrorBox, fmt, hhmm, dateTime } from '../components/ui-bits';

export default function ForecastPage({ deadline }: { deadline: string }) {
  const [day, setDay] = useState(15);
  const { data, error } = useLoad(() => getDay({ day, deadline }), [day, deadline]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Delivery day</span>
        <DayPicker day={day} onChange={setDay} />
        <span className="text-sm text-muted-foreground">Decision deadline: {day === 1 ? 31 : day - 1} {day === 1 ? 'Dec 2025' : 'Jan'} at {deadline}</span>
      </div>
      {error ? <ErrorBox msg={error} /> : !data ? <Loading /> : (
        <>
          <Card className="p-4 bg-accent text-accent-foreground text-sm flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              {data.publishTimesUsed.length
                ? <>Forecast published at <b>{data.publishTimesUsed.map(dateTime).join(', ')}</b> UTC — the latest before the deadline.</>
                : <>No forecast was published before this deadline for this day.</>}
              {data.sameAsPresets.length > 0 && <> The {data.sameAsPresets.join(' and ')} deadline picks the same version — no forecast was published in between.</>}
            </div>
          </Card>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Tile label="Forecast energy" value={`${fmt(data.forecastMwh)} MWh`} />
            <Tile label="Actual energy" value={`${fmt(data.actualMwh)} MWh`} />
            <Tile label="Lowest forecast" value={`${fmt(data.minForecast?.mw)} MW`} sub={data.minForecast ? `at ${hhmm(data.minForecast.time)}` : undefined} />
            <Tile label="Highest forecast" value={`${fmt(data.maxForecast?.mw)} MW`} sub={data.maxForecast ? `at ${hhmm(data.maxForecast.time)}` : undefined} />
          </div>
          <Card className="p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold">Forecast vs actual (MW, half-hourly)</span>
              <span className="text-muted-foreground">{data.missing} of 48 half-hours missing a pair{data.mae != null && ` · day MAE ${fmt(data.mae)} MW`}</span>
            </div>
            <div className="h-80">
              <ResponsiveContainer>
                <LineChart data={data.rows.map((r) => ({ ...r, t: hhmm(r.startTime) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="t" fontSize={11} interval={5} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: number) => `${fmt(v)} MW`} />
                  <Legend />
                  <Line name="Forecast (hourly)" dataKey="forecast" stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={{ r: 2.5, fill: 'hsl(var(--chart-1))' }} connectNulls />
                  <Line name="Actual (half-hourly)" dataKey="actual" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Elexon publishes wind forecasts hourly (dots), so the forecast line joins hourly points; :30 half-hours have no forecast and count as missing pairs. Energy calculation: hourly forecast MW × 1.0 h, half-hourly actual MW × 0.5 h.</p>
          </Card>
        </>
      )}
    </div>
  );
}
