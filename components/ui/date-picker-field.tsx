"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function parseDateValue(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = parse(value, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateValue(date: Date | undefined): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export function DatePickerField({
  className,
  defaultValue,
  disabled,
  id,
  name,
  placeholder = "选择日期",
  value,
  onValueChange
}: {
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id: string;
  name?: string;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const currentValue = isControlled ? value ?? "" : internalValue;
  const selectedDate = React.useMemo(() => parseDateValue(currentValue), [currentValue]);

  const commitValue = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange]
  );

  return (
    <div className="w-full">
      {name ? <input name={name} type="hidden" value={currentValue} /> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "h-9 w-full justify-between rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-normal text-zinc-950 shadow-sm hover:bg-white",
              !selectedDate && "text-zinc-500",
              className
            )}
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          >
            {selectedDate ? format(selectedDate, "yyyy-MM-dd") : placeholder}
            <CalendarIcon className="h-4 w-4 text-zinc-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="z-[120] w-auto rounded-xl border border-zinc-200 bg-white p-0 shadow-md"
        >
          <Calendar
            mode="single"
            onSelect={(date) => commitValue(formatDateValue(date))}
            selected={selectedDate}
          />
          <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2">
            <Button className="h-auto px-0 py-0 text-zinc-500 hover:text-zinc-950" onClick={() => commitValue("")} type="button" variant="link">
              清除
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
