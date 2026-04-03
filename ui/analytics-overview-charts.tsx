"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis
} from "recharts";

import type { AnalyticsDashboard } from "@/backend/analytics/contracts/analytics.types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";

type Props = {
  dashboard: AnalyticsDashboard;
};

const semanticChartConfig = {
  issue_found: { label: "发现问题", color: "#dc2626" },
  pass: { label: "未发现问题", color: "#16a34a" },
  inconclusive: { label: "无法判定", color: "#d97706" },
  inspection_failed: { label: "巡检失败", color: "#52525b" }
} satisfies ChartConfig;

const trendChartConfig = {
  result_count: { label: "巡检结果", color: "#2563eb" },
  issue_count: { label: "问题数", color: "#dc2626" },
  pending_review_count: { label: "待复核", color: "#d97706" }
} satisfies ChartConfig;

const rectificationChartConfig = {
  completed: { label: "已整改", color: "#16a34a" },
  pending: { label: "待整改", color: "#d97706" },
  overdue: { label: "超期未整改", color: "#dc2626" },
  sync_failed: { label: "同步失败", color: "#52525b" }
} satisfies ChartConfig;

const reviewChartConfig = {
  pending: { label: "待人工复核", color: "#d97706" },
  manual_completed: { label: "人工已复核", color: "#2563eb" },
  auto_completed: { label: "自动已复核", color: "#16a34a" }
} satisfies ChartConfig;

export function AnalyticsOverviewCharts({ dashboard }: Props) {
  const semanticData = dashboard.semantic_distribution.map((item) => ({
    key: item.state,
    name: item.label,
    value: item.count,
    issueCount: item.issue_count,
    fill: semanticChartConfig[item.state]?.color || "#52525b"
  }));

  const trendData = dashboard.daily_trend.map((item) => ({
    snapshot_date: item.snapshot_date.slice(5),
    result_count: item.result_count,
    issue_count: item.issue_count,
    pending_review_count: item.pending_review_count
  }));

  const rectificationData = [
    {
      key: "completed",
      label: "已整改",
      value: dashboard.rectification_overview.completed_count,
      fill: rectificationChartConfig.completed.color
    },
    {
      key: "pending",
      label: "待整改",
      value: dashboard.rectification_overview.pending_count,
      fill: rectificationChartConfig.pending.color
    },
    {
      key: "overdue",
      label: "超期未整改",
      value: dashboard.rectification_overview.overdue_count,
      fill: rectificationChartConfig.overdue.color
    },
    {
      key: "sync_failed",
      label: "同步失败",
      value: dashboard.rectification_overview.sync_failed_count,
      fill: rectificationChartConfig.sync_failed.color
    }
  ];

  const reviewData = [
    ...dashboard.review_status_distribution.map((item) => ({
      key: item.review_state,
      label: item.label,
      value: item.count,
      fill:
        item.review_state === "pending"
          ? reviewChartConfig.pending.color
          : item.review_state === "manual_completed"
            ? reviewChartConfig.manual_completed.color
            : reviewChartConfig.auto_completed.color
    }))
  ];

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>巡检结论分布</CardTitle>
          <CardDescription>先判断巡检结果的整体质量结构，再看后续治理动作。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[280px] w-full" config={semanticChartConfig}>
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => `${value} 条结果`} />}
              />
              <Pie
                data={semanticData}
                dataKey="value"
                innerRadius={62}
                outerRadius={96}
                paddingAngle={4}
                nameKey="name"
              >
                {semanticData.map((entry) => (
                  <Cell fill={entry.fill} key={entry.key} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
          <div className="grid gap-2 sm:grid-cols-2">
            {semanticData.map((item) => (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3" key={item.key}>
                <div className="text-sm font-medium text-zinc-950">{item.name}</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-950">{item.value}</div>
                <div className="mt-1 text-xs text-zinc-500">关联问题 {item.issueCount}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>整改闭环状态</CardTitle>
          <CardDescription>用单据状态判断当前治理动作是否真正推进。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[280px] w-full" config={rectificationChartConfig}>
            <BarChart data={rectificationData} barSize={44}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="label" tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value} 张单据`} />} />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                {rectificationData.map((entry) => (
                  <Cell fill={entry.fill} key={entry.key} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="grid gap-1">
                <span className="text-sm font-medium text-zinc-950">整改闭环率</span>
                <span className="text-xs text-zinc-500">已整改 / 已下发整改单</span>
              </div>
              <Badge variant={dashboard.rectification_overview.close_rate >= 80 ? "secondary" : dashboard.rectification_overview.close_rate >= 50 ? "outline" : "default"}>
                {dashboard.rectification_overview.close_rate}%
              </Badge>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-950">平均整改时长</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-950">
                {dashboard.rectification_overview.average_rectification_duration_days} 天
              </div>
              <div className="mt-1 text-xs text-zinc-500">按已整改整改单的创建到完成时间计算</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>近 14 日巡检趋势</CardTitle>
          <CardDescription>把巡检量、问题数和待复核积压放在一张图里，快速看出最近波动。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[320px] w-full" config={trendChartConfig}>
            <LineChart data={trendData}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="snapshot_date" tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value} 条`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="result_count" dot={false} stroke="var(--color-result_count)" strokeWidth={2.5} type="monotone" />
              <Line dataKey="issue_count" dot={false} stroke="var(--color-issue_count)" strokeWidth={2.5} type="monotone" />
              <Line dataKey="pending_review_count" dot={false} stroke="var(--color-pending_review_count)" strokeWidth={2.5} type="monotone" />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>复核状态分布</CardTitle>
          <CardDescription>先看哪些结果还在待人工处理，再看人工复核团队的效率表现。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ChartContainer className="h-[320px] w-full" config={reviewChartConfig}>
            <BarChart data={reviewData} barSize={48}>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="label" tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}`} />} />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                {reviewData.map((entry) => (
                  <Cell fill={entry.fill} key={entry.key} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-950">平均复核时长</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-950">
                {dashboard.review_efficiency.average_review_latency_hours} 小时
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-950">人工复核动作数</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-950">
                {dashboard.review_efficiency.review_action_count}
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="text-sm font-medium text-zinc-950">参与复核人数</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-950">
                {dashboard.review_efficiency.operator_count}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
