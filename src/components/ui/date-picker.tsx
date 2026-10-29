import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { DayPicker, type DayPickerSingleProps } from 'react-day-picker';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

import { cn } from '@project/components/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// Calendar styles for react-day-picker v8, tuned to the app theme.
const calendarClassNames: DayPickerSingleProps['classNames'] = {
  months: 'flex space-y-4 flex-col space-x-0',
  month: 'space-y-4',
  caption: 'flex justify-center pt-1 relative items-center',
  caption_label: 'text-sm font-medium',
  nav_button: cn(
    'inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0 opacity-50 hover:opacity-100',
  ),
  navbar: 'absolute inset-x-0 top-0 flex justify-between',
  table: 'w-full border-collapse',
  head_row: 'flex',
  head_cell: 'w-8 text-center text-xs font-normal text-muted-foreground',
  row: 'flex w-full mt-2',
  cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
  day: cn(
    'inline-flex h-8 w-8 items-center justify-center rounded-md p-0 font-normal hover:bg-accent hover:text-accent-foreground cursor-pointer',
  ),
  day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-normal',
  day_today: '',
  day_outside: 'text-muted-foreground opacity-40',
  day_disabled: 'text-muted-foreground opacity-40 cursor-not-allowed',
};

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  captionLayout?: 'buttons' | 'dropdown';
  fromYear?: number;
  toYear?: number;
}

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = 'Pick a date',
  className,
  captionLayout = 'buttons',
  fromYear,
  toYear,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState<Date>(value || new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-start gap-2 whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
          <span className={cn(!value && 'text-muted-foreground')}>
            {value ? value.toLocaleDateString() : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-auto shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date);
            setOpen(false);
          }}
          month={month}
          onMonthChange={setMonth}
          captionLayout={captionLayout}
          fromYear={fromYear}
          toYear={toYear}
          classNames={calendarClassNames}
        />
      </PopoverContent>
    </Popover>
  );
}

// Prefer plain JSX with { ...props } over React.createElement for clarity.
function Calendar({ ...props }: DayPickerSingleProps) {
  return <DayPicker {...props} />;
}
