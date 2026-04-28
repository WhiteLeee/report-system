"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "./report-result-detail-view.module.css";

import { Button } from "@/components/ui/button";
import { getResolvedImageNotice, type ResolvedReportImageState } from "@/ui/report/report-detail-helpers";

function getEvidenceStatusLabel(imageState: ResolvedReportImageState): string {
  if (imageState.unstable) {
    return "证据图未稳定";
  }
  if (imageState.evidenceUrl && imageState.mode === "evidence" && !imageState.isFallback) {
    return "标注图";
  }
  return "原图";
}

export function ReportResultImagePreviewCard({
  currentStoreName,
  evidencePath,
  imageState,
  nextResultPath,
  originalPath,
  previousResultPath,
  previewPath,
  resultCounterText
}: {
  currentStoreName: string;
  evidencePath: string;
  imageState: ResolvedReportImageState;
  nextResultPath: string;
  originalPath: string;
  previousResultPath: string;
  previewPath: string;
  resultCounterText: string;
}) {
  const router = useRouter();
  const imageNotice = getResolvedImageNotice(imageState);

  function handleImageError() {
    if (imageState.mode === "evidence" && imageState.evidenceUrl && imageState.originalUrl) {
      router.replace(originalPath);
    }
  }

  return (
    <div className={styles.scenePreviewCard}>
      <Link className={styles.scenePreviewThumbLink} href={previewPath}>
        {imageState.url ? (
          <img alt={currentStoreName} className={styles.scenePreviewThumb} onError={handleImageError} src={imageState.url} />
        ) : (
          <div className={styles.imageUnavailable}>图片不可用</div>
        )}
      </Link>
      <div className={styles.scenePreviewMeta}>
        <div className={styles.imageModeRow}>
          <span className={styles.imageStatusPill}>{getEvidenceStatusLabel(imageState)}</span>
          {imageState.unstable ? (
            <span className={styles.imageRiskText}>
              {imageState.unstableReason || "长期可访问性存在风险"}
            </span>
          ) : null}
        </div>
        {imageNotice ? <span className={styles.imageFallbackNotice}>{imageNotice}</span> : null}
        <span className={styles.scenePreviewSubmeta}>{resultCounterText}</span>
      </div>
      <div className={styles.imageModeActions}>
        {imageState.evidenceUrl ? (
          <Button asChild size="sm" variant={imageState.mode === "evidence" ? "default" : "secondary"}>
            <Link href={evidencePath}>返回标注图</Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="secondary">返回标注图</Button>
        )}
        {imageState.originalUrl ? (
          <Button asChild size="sm" variant={imageState.mode === "original" ? "default" : "secondary"}>
            <Link href={originalPath}>查看原图</Link>
          </Button>
        ) : (
          <Button disabled size="sm" variant="secondary">查看原图</Button>
        )}
      </div>
      <div className={styles.scenePreviewActions}>
        <Button asChild className={styles.scenePrimaryAction} size="sm">
          <Link href={previewPath}>放大预览</Link>
        </Button>
        {previousResultPath ? (
          <Button asChild className={styles.sceneSecondaryAction} size="sm" variant="secondary">
            <Link href={previousResultPath}>上一条</Link>
          </Button>
        ) : (
          <Button className={styles.sceneSecondaryAction} disabled size="sm" variant="secondary">
            上一条
          </Button>
        )}
        {nextResultPath ? (
          <Button asChild className={styles.sceneSecondaryAction} size="sm" variant="secondary">
            <Link href={nextResultPath}>下一条</Link>
          </Button>
        ) : (
          <Button className={styles.sceneSecondaryAction} disabled size="sm" variant="secondary">
            下一条
          </Button>
        )}
      </div>
    </div>
  );
}
