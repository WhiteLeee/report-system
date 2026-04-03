"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import type { AnalyticsDashboard } from "@/backend/analytics/contracts/analytics.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";

type Props = {
  dashboard: AnalyticsDashboard;
};

const governanceChartConfig = {
  governance_score: { label: "督导分", color: "#dc2626" }
} satisfies ChartConfig;

const closeRateChartConfig = {
  close_rate: { label: "闭环率", color: "#16a34a" }
} satisfies ChartConfig;

export function AnalyticsGovernanceCharts({ dashboard }: Props) {
  const governanceData = dashboard.organization_governance_ranking.slice(0, 8).map((item) => ({
    name: item.organization_name,
    shortName: item.organization_name.length > 8 ? `${item.organization_name.slice(0, 8)}…` : item.organization_name,
    governance_score: item.governance_score,
    pending_review_count: item.pending_review_count,
    overdue_count: item.overdue_count,
    high_risk_franchisee_count: item.high_risk_franchisee_count,
    fill: item.governance_score >= 10 ? "#dc2626" : item.governance_score >= 5 ? "#d97706" : "#52525b"
  }));

  const closeRateData = dashboard.franchisee_close_rate_ranking.slice(0, 8).map((item) => ({
    name: item.franchisee_name,
    shortName: item.franchisee_name.length > 8 ? `${item.franchisee_name.slice(0, 8)}…` : item.franchisee_name,
    close_rate: item.close_rate,
    overdue_count: item.overdue_count,
    order_count: item.order_count,
    fill: item.close_rate >= 80 ? "#16a34a" : item.close_rate >= 50 ? "#d97706" : "#dc2626"
  }));

  const topGovernance = dashboard.organization_governance_ranking[0];
  const lowestCloseRate = dashboard.franchisee_close_rate_ranking[0];

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <Card>
        <CardHeader>
          <CardTitle>运营组织督导分布</CardTitle>
          <CardDescription>优先看哪个组织辖区积压最多、超期最多，需要运营督导优先介入。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[320px] w-full" config={governanceChartConfig}>
            <BarChart data={governanceData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis allowDecimals={false} axisLine={false} dataKey="governance_score" tickLine={false} type="number" />
              <YAxis axisLine={false} dataKey="shortName" tickLine={false} type="category" width={110} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value} 分`}
                    labelFormatter={(value) => {
                      const row = governanceData.find((item) => item.shortName === value);
                      return row?.name || value;
                    }}
                  />
                }
              />
              <Bar dataKey="governance_score" radius={[0, 12, 12, 0]}>
                {governanceData.map((entry) => (
                  <Cell fill={entry.fill} key={entry.name} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          {topGovernance ? (
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-zinc-950">当前最需督导组织</span>
                <span className="text-xs text-zinc-500">
                  {topGovernance.organization_name} · 待复核 {topGovernance.pending_review_count} · 超期 {topGovernance.overdue_count}
                </span>
              </div>
              <Badge variant={topGovernance.governance_score >= 10 ? "default" : "outline"}>
                {topGovernance.governance_score} 分
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>加盟商整改闭环率</CardTitle>
          <CardDescription>用闭环率识别经营责任主体的整改执行效果，而不是只看问题数量。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[320px] w-full" config={closeRateChartConfig}>
            <BarChart data={closeRateData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis axisLine={false} dataKey="close_rate" domain={[0, 100]} tickLine={false} type="number" />
              <YAxis axisLine={false} dataKey="shortName" tickLine={false} type="category" width={110} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => `${value}%`}
                    labelFormatter={(value) => {
                      const row = closeRateData.find((item) => item.shortName === value);
                      return row?.name || value;
                    }}
                  />
                }
              />
              <Bar dataKey="close_rate" radius={[0, 12, 12, 0]}>
                {closeRateData.map((entry) => (
                  <Cell fill={entry.fill} key={entry.name} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          {lowestCloseRate ? (
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-zinc-950">当前闭环最弱加盟商</span>
                <span className="text-xs text-zinc-500">
                  {lowestCloseRate.franchisee_name} · 整改单 {lowestCloseRate.order_count} · 超期 {lowestCloseRate.overdue_count}
                </span>
              </div>
              <Badge variant={lowestCloseRate.close_rate >= 80 ? "secondary" : lowestCloseRate.close_rate >= 50 ? "outline" : "default"}>
                {lowestCloseRate.close_rate}%
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
