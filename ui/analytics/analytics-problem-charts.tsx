"use client";

import type { AnalyticsDashboard } from "@/backend/analytics/contracts/analytics.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  XAxis,
  YAxis
} from "@/components/ui/chart";
import { EmptyState } from "@/components/ui/empty-state";

type Props = {
  dashboard: AnalyticsDashboard;
};

const skillChartConfig = {
  count: { label: "命中问题数", color: "#2563eb" }
} satisfies ChartConfig;

const severityChartConfig = {
  critical: { label: "严重", color: "#991b1b" },
  high: { label: "高", color: "#dc2626" },
  medium: { label: "中", color: "#d97706" },
  low: { label: "低", color: "#16a34a" },
  unspecified: { label: "未标注", color: "#52525b" }
} satisfies ChartConfig;

export function AnalyticsProblemCharts({ dashboard }: Props) {
  const skillData = dashboard.skill_distribution.slice(0, 8).map((item) => ({
    skillId: item.skill_id,
    name: item.skill_name,
    shortName: item.skill_name.length > 10 ? `${item.skill_name.slice(0, 10)}…` : item.skill_name,
    count: item.count,
    storeCount: item.store_count,
    resultCount: item.result_count,
    fill: "#2563eb"
  }));

  const severityData = dashboard.severity_distribution.map((item) => ({
    severity: item.severity,
    label: item.label,
    count: item.count,
    storeCount: item.store_count,
    resultCount: item.result_count,
    fill:
      item.severity === "critical"
        ? severityChartConfig.critical.color
        : item.severity === "high"
          ? severityChartConfig.high.color
          : item.severity === "medium"
            ? severityChartConfig.medium.color
            : item.severity === "low"
              ? severityChartConfig.low.color
              : severityChartConfig.unspecified.color
  }));

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <Card>
        <CardHeader>
          <CardTitle>技能命中分布</CardTitle>
          <CardDescription>看清当前问题主要集中在哪些巡检技能，便于识别规则能力和业务风险的集中点。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {skillData.length > 0 ? (
            <>
              <ChartContainer className="h-[320px] w-full" config={skillChartConfig}>
                <BarChart data={skillData} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis allowDecimals={false} axisLine={false} dataKey="count" tickLine={false} type="number" />
                  <YAxis axisLine={false} dataKey="shortName" tickLine={false} type="category" width={120} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => `${value} 个问题`}
                        labelFormatter={(value) => {
                          const row = skillData.find((item) => item.shortName === value);
                          return row?.name || value;
                        }}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[0, 12, 12, 0]}>
                    {skillData.map((item) => (
                      <Cell fill={item.fill} key={item.skillId || item.name} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="grid gap-2 sm:grid-cols-2">
                {skillData.slice(0, 4).map((item) => (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-accent)] px-4 py-3" key={`summary:${item.skillId || item.name}`}>
                    <div className="text-sm font-medium text-[var(--text)]">{item.name}</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{item.count}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      覆盖 {item.storeCount} 家门店 · {item.resultCount} 条结果
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-6">
              <EmptyState>当前筛选范围还没有技能命中数据。</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>严重程度分布</CardTitle>
          <CardDescription>区分高严重和低严重问题，避免只看总数却看不见真正优先级。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {severityData.length > 0 ? (
            <>
              <ChartContainer className="h-[320px] w-full" config={severityChartConfig}>
                <BarChart data={severityData} barSize={48}>
                  <CartesianGrid vertical={false} />
                  <XAxis axisLine={false} dataKey="label" tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent formatter={(value) => `${value} 个问题`} />
                    }
                  />
                  <Bar dataKey="count" radius={[12, 12, 0, 0]}>
                    {severityData.map((item) => (
                      <Cell fill={item.fill} key={item.severity} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
              <div className="grid gap-2 sm:grid-cols-2">
                {severityData.map((item) => (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-accent)] px-4 py-3" key={`severity:${item.severity}`}>
                    <div className="text-sm font-medium text-[var(--text)]">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold text-[var(--text)]">{item.count}</div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      覆盖 {item.storeCount} 家门店 · {item.resultCount} 条结果
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--line)] p-6">
              <EmptyState>当前筛选范围还没有严重程度数据。</EmptyState>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
