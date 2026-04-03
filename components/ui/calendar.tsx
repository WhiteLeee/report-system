"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row",
        month: "space-y-4",
        caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-medium",
        nav: "flex items-center gap-1",
        button_previous: cn(buttonVariants({ variant: "ghost", size: "icon" }), "absolute left-1 top-1 h-7 w-7"),
        button_next: cn(buttonVariants({ variant: "ghost", size: "icon" }), "absolute right-1 top-1 h-7 w-7"),
        month_caption: "flex h-7 items-center justify-center",
        weekdays: "flex",
        weekday: "w-9 text-[0.8rem] font-normal text-zinc-500",
        week: "mt-2 flex w-full",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-zinc-100/50 [&:has([aria-selected])]:bg-zinc-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 hover:text-zinc-50 focus:bg-zinc-900 focus:text-zinc-50",
        today: "bg-zinc-100 text-zinc-950",
        outside: "text-zinc-500 opacity-50 aria-selected:bg-zinc-100/50 aria-selected:text-zinc-500 aria-selected:opacity-30",
        disabled: "text-zinc-500 opacity-50",
        range_middle: "aria-selected:bg-zinc-100 aria-selected:text-zinc-950",
        hidden: "invisible",
        dropdowns: "flex items-center gap-2",
        dropdown:
          "h-8 rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none focus-visible:border-zinc-950 focus-visible:ring-1 focus-visible:ring-zinc-950",
        ...classNames
      }}
      components={{
        Chevron: ({ orientation, className: iconClassName, ...iconProps }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          ) : (
            <ChevronRight className={cn("h-4 w-4", iconClassName)} {...iconProps} />
          )
      }}
      locale={zhCN}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { Calendar };
