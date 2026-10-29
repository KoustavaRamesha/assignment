import { toast } from 'sonner';
import { DatePicker } from '@project/components/ui/date-picker';

// Calendar picker limited to January 2026 delivery days. Value is day-of-month (1–31).
export default function DayPicker({ day, onChange }: { day: number; onChange: (d: number) => void }) {
  return (
    <DatePicker
      className="w-[200px]"
      value={new Date(2026, 0, day)}
      onChange={(d) => {
        if (!d) return;
        if (d.getFullYear() !== 2026 || d.getMonth() !== 0) {
          toast.error('Only delivery days 1–31 January 2026 are available');
          return;
        }
        onChange(d.getDate());
      }}
    />
  );
}
