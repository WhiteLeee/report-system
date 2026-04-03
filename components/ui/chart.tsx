"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartTooltipEntry = {
  dataKey?: string | number;
  name?: string;
  color?: string;
  value?: number | string;
};

type ChartLegendEntry = {
  dataKey?: string | number;
  value?: string;
  color?: string;
};

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

export function ChartContainer({
  id,
  className,
  config,
  children
}: React.ComponentProps<"div"> & { config: ChartConfig }) {
  const chartId = React.useId();
  const resolvedId = `chart-${id || chartId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-zinc-500 [&_.recharts-cartesian-grid_line]:stroke-zinc-200 [&_.recharts-legend-item-text]:text-zinc-700 [&_.recharts-pie-label-text]:fill-zinc-700 [&_.recharts-reference-line-line]:stroke-zinc-300 flex aspect-video justify-center text-xs",
          className
        )}
        data-chart={resolvedId}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: Object.entries(config)
              .filter(([, item]) => item.color)
              .map(([key, item]) => `[data-chart=${resolvedId}] { --color-${key}: ${item.color}; }`)
              .join("\n")
          }}
        />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  formatter
}: {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  labelFormatter?: (value: string | number | undefined) => React.ReactNode;
  formatter?: (value: number, name: string) => React.ReactNode;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="grid min-w-40 gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-zinc-950">
        {labelFormatter ? labelFormatter(label) : label}
      </div>
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey || item.name || "");
          const meta = config[key];
          return (
            <div className="flex items-center justify-between gap-4" key={key}>
              <div className="flex items-center gap-2 text-zinc-600">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color || meta?.color || "currentColor" }}
                />
                <span>{meta?.label || item.name}</span>
              </div>
              <span className="font-medium text-zinc-950">
                {formatter ? formatter(Number(item.value || 0), key) : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartLegendContent({
  payload
}: {
  payload?: ChartLegendEntry[];
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-4 pt-2">
      {payload.map((item) => {
        const key = String(item.dataKey || item.value || "");
        const meta = config[key];
        return (
          <div className="flex items-center gap-2 text-xs text-zinc-600" key={key}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color || meta?.color || "currentColor" }}
            />
            <span>{meta?.label || item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;
