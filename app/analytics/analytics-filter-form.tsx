"use client";

import * as React from "react";
import Link from "next/link";

import styles from "./analytics-page.module.css";

import type { AnalyticsFilters } from "@/backend/analytics/contracts/analytics.filters";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { NativeSelect } from "@/components/ui/native-select";

type SelectOption = {
  value: string;
  label: string;
};

type StoreOption = SelectOption & {
  organizationId: string;
};

type AnalyticsFilterFormProps = {
  currentView: string;
  hasActiveFilters: boolean;
  hasAdvancedFilterValues: boolean;
  filters: AnalyticsFilters;
  reportTypeOptions: SelectOption[];
  organizationOptions: SelectOption[];
  storeOptions: StoreOption[];
  topicOptions: SelectOption[];
  planOptions: SelectOption[];
  queryString: string;
  isAdmin: boolean;
};

export function AnalyticsFilterForm({
  currentView,
  hasActiveFilters,
  hasAdvancedFilterValues,
  filters,
  reportTypeOptions,
  organizationOptions,
  storeOptions,
  topicOptions,
  planOptions,
  queryString,
  isAdmin
}: AnalyticsFilterFormProps) {
  const [organizationId, setOrganizationId] = React.useState(filters.organizationId || "");
  const [storeId, setStoreId] = React.useState(filters.storeId || "");
  const [isExporting, setIsExporting] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(hasActiveFilters);

  React.useEffect(() => {
    setOrganizationId(filters.organizationId || "");
  }, [filters.organizationId]);

  React.useEffect(() => {
    setStoreId(filters.storeId || "");
  }, [filters.storeId]);

  React.useEffect(() => {
    if (hasActiveFilters) {
      setIsOpen(true);
    }
  }, [hasActiveFilters]);

  const linkedStores = organizationId
    ? storeOptions.filter((item) => item.organizationId === organizationId)
    : storeOptions;

  React.useEffect(() => {
    if (!storeId) {
      return;
    }
    if (linkedStores.some((item) => item.value === storeId)) {
      return;
    }
    setStoreId("");
  }, [linkedStores, storeId]);

  const handleExportCsv = React.useCallback(async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch(`/api/analytics/export${queryString}`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error(`导出失败（${response.status}）`);
      }

      const csvBlob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const matchedName = disposition.match(/filename=\"([^\"]+)\"/i);
      const fileName = matchedName?.[1] || `analytics-export-${new Date().toISOString().slice(0, 10)}.csv`;

      const objectUrl = URL.createObjectURL(csvBlob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("导出 CSV 失败:", error);
      window.alert("导出失败，请稍后重试。");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, queryString]);

  return (
    <details className={styles.filterDisclosure} open={isOpen}>
      <summary
        className={styles.filterDisclosureSummary}
        onClick={(event) => {
          event.preventDefault();
          setIsOpen((value) => !value);
        }}
      >
        <strong className={styles.filterDisclosureTitle}>筛选条件</strong>
        <div className={styles.filterDisclosureMeta}>
          <span className={styles.filterToggleLabel}>{isOpen ? "收起筛选" : "展开筛选"}</span>
        </div>
      </summary>
      {isOpen ? (
        <div className={styles.filterDisclosureBody}>
          <form className={styles.filterForm} method="get">
        <input name="view" type="hidden" value={currentView} />
        <div className={styles.filterSection}>
          <div className={styles.filterGrid}>
            <div className="field">
              <label htmlFor="organizationId">运营组织</label>
              <NativeSelect
                id="organizationId"
                name="organizationId"
                onChange={(event) => {
                  const nextOrganizationId = event.target.value;
                  setOrganizationId(nextOrganizationId);
                  if (!storeId) {
                    return;
                  }
                  const nextLinkedStores = nextOrganizationId
                    ? storeOptions.filter((item) => item.organizationId === nextOrganizationId)
                    : storeOptions;
                  if (!nextLinkedStores.some((item) => item.value === storeId)) {
                    setStoreId("");
                  }
                }}
                value={organizationId}
              >
                <option value="">全部组织</option>
                {organizationOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="field">
              <label htmlFor="storeId">门店</label>
              <NativeSelect
                id="storeId"
                name="storeId"
                onChange={(event) => {
                  setStoreId(event.target.value);
                }}
                value={storeId}
              >
                <option value="">全部门店</option>
                {linkedStores.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="field">
              <label htmlFor="startDate">开始日期</label>
              <DatePickerField defaultValue={filters.startDate} id="startDate" name="startDate" />
            </div>
            <div className="field">
              <label htmlFor="endDate">结束日期</label>
              <DatePickerField defaultValue={filters.endDate} id="endDate" name="endDate" />
            </div>
            <div className="field">
              <label htmlFor="reportType">报告类型</label>
              <NativeSelect defaultValue={filters.reportType} id="reportType" name="reportType">
                <option value="">全部类型</option>
                {reportTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="field">
              <label htmlFor="topic">报告主题</label>
              <NativeSelect defaultValue={filters.topic} id="topic" name="topic">
                <option value="">全部主题</option>
                {topicOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="field">
              <label htmlFor="planId">计划</label>
              <NativeSelect defaultValue={filters.planId} id="planId" name="planId">
                <option value="">全部计划</option>
                {planOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>

        <div className={styles.filterActions}>
          <Button asChild size="sm" variant="secondary">
            <Link href="/analytics">重置</Link>
          </Button>
          <Button onClick={handleExportCsv} size="sm" type="button" variant="secondary">
            {isExporting ? "导出中..." : "导出 CSV"}
          </Button>
          {isAdmin ? (
            <Button asChild size="sm" variant="secondary">
              <Link href="/analytics/jobs">分析任务</Link>
            </Button>
          ) : null}
          <Button size="sm" type="submit">
            筛选
          </Button>
        </div>
          </form>
        </div>
      ) : null}
    </details>
  );
}
