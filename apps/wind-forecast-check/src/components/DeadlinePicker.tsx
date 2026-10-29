import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';

const OPTIONS = [
  { v: '09:20', l: '09:20 · EPEX 60-min (default)' },
  { v: '09:50', l: '09:50 · N2EX day-ahead' },
  { v: '15:30', l: '15:30 · EPEX 30-min' },
];

export default function DeadlinePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Deadline (day before)</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[230px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
