import { useState } from 'react';
import { Download, Wind } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@project/components/ui/tabs';
import { Toaster } from '@project/components/ui/sonner';
import DeadlinePicker from './components/DeadlinePicker';
import ForecastPage from './pages/ForecastPage';
import AccuracyPage from './pages/AccuracyPage';
import ProofPage from './pages/ProofPage';
import CoveragePage from './pages/CoveragePage';
import ReportPage from './pages/ReportPage';

export default function App() {
  const [deadline, setDeadline] = useState('09:20');
  return (
    <div className="min-h-screen">
      <Toaster />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Wind className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Wind Forecast Check</h1>
              <p className="text-sm text-muted-foreground">GB wind · January 2026 · what the buyer actually had at the deadline</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <DeadlinePicker value={deadline} onChange={setDeadline} />
            <a href="/report/Wind_Report_January_2026.pdf" download className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><Download className="h-4 w-4" />Executive PDF</a>
            <a href="https://github.com/KoustavaRamesha/assignment" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">GitHub</a>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="forecast">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
            <TabsTrigger value="proof">Proof</TabsTrigger>
            <TabsTrigger value="coverage">Coverage</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
          </TabsList>
          <TabsContent value="forecast"><ForecastPage deadline={deadline} /></TabsContent>
          <TabsContent value="accuracy"><AccuracyPage deadline={deadline} /></TabsContent>
          <TabsContent value="proof"><ProofPage deadline={deadline} /></TabsContent>
          <TabsContent value="coverage"><CoveragePage deadline={deadline} /></TabsContent>
          <TabsContent value="report"><ReportPage /></TabsContent>
        </Tabs>
      </main>
      <footer className="container mx-auto px-4 pb-8 text-xs text-muted-foreground">
        Source: Elexon BMRS (WINDFOR forecasts, FUELHH actuals, WIND only). Times in UTC (= UK time in January).
      </footer>
    </div>
  );
}
