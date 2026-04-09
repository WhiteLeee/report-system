"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { CircleHelp } from "@/components/ui/icons";

type JobHelpType = "facts" | "snapshot";

interface JobHelpDialogProps {
  type: JobHelpType;
}

const contentMap: Record<JobHelpType, { title: string; meaning: string; input: string; output: string }> = {
  facts: {
    title: "分析事实是什么？",
    meaning:
      "分析事实是把业务原始数据整理成分析专用明细层，用统一字段承载门店、组织、加盟商、问题、复核、整改等治理维度。",
    input:
      "输入数据来自报告业务表：report_image（巡检结果）、report_issue（问题项）、report_review_log（复核记录）、report_rectification_order（整改单）等。",
    output:
      "输出到 analytics_*_fact 表：analytics_result_fact、analytics_issue_fact、analytics_review_fact、analytics_rectification_fact。后续统计查询主要读取这些事实表。"
  },
  snapshot: {
    title: "日快照是什么？",
    meaning:
      "日快照是在分析事实基础上做按天汇总的统计层，用于快速展示概览和趋势，避免每次都扫描全量明细。",
    input:
      "输入数据来自分析事实表（analytics_*_fact），按日期和关键维度聚合。",
    output:
      "输出到 analytics_daily_*_snapshot 表：analytics_daily_overview_snapshot、analytics_daily_semantic_snapshot。分析首页的概览与趋势优先读取这些快照。"
  }
};

export function JobHelpDialog({ type }: JobHelpDialogProps) {
  const content = contentMap[type];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button aria-label={`${content.title}说明`} className="h-5 w-5 p-0" size="icon" type="button" variant="ghost">
          <CircleHelp className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          <DialogDescription>这个说明用于理解任务在处理什么数据，以及处理后的结果落在哪里。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">定义：</strong>
            {content.meaning}
          </p>
          <p>
            <strong className="text-foreground">处理输入：</strong>
            {content.input}
          </p>
          <p>
            <strong className="text-foreground">处理输出：</strong>
            {content.output}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
