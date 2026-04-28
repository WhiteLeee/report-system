export type RectificationIssueSelection = {
  id: number;
  title: string;
  imageUrls?: string[];
};

export type RectificationPreviewOrder = {
  description: string;
  issueCount: number;
  selectedIssues: RectificationIssueSelection[];
  imageUrls: string[];
  shouldCorrected: string;
};

export class RectificationPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RectificationPreviewError";
  }
}

const EMPTY_ISSUE_FALLBACK_DESCRIPTION = "当前结果未勾选具体问题项，请门店结合巡检图片完成整改。";

function normalizeIssues(issues: RectificationIssueSelection[]): RectificationIssueSelection[] {
  return Array.from(
    new Map(
      issues
        .map((issue) => ({
          id: Number(issue.id),
          title: String(issue.title || "").trim(),
          imageUrls: normalizeImageUrls(issue.imageUrls ?? [])
        }))
        .filter((issue) => Number.isInteger(issue.id) && issue.id > 0 && issue.title)
        .map((issue) => [issue.id, issue] as const)
    ).values()
  );
}

function normalizeImageUrls(imageUrls: string[]): string[] {
  return Array.from(
    new Set(imageUrls.map((url) => String(url || "").trim()).filter(Boolean))
  ).slice(0, 9);
}

function buildChunkImageUrls(chunk: RectificationIssueSelection[], fallbackImageUrls: string[]): string[] {
  const issueImageUrls = normalizeImageUrls(chunk.flatMap((issue) => issue.imageUrls ?? []));
  return issueImageUrls.length > 0 ? issueImageUrls : fallbackImageUrls;
}

function formatImageIndexes(indexes: number[]): string {
  return indexes.map((index) => `第${index}张`).join("、");
}

function buildIssueLine(
  issue: RectificationIssueSelection,
  allIssues: RectificationIssueSelection[],
  chunkImageUrls: string[]
): string {
  const issueNumber = allIssues.findIndex((candidate) => candidate.id === issue.id) + 1;
  const imageIndexes = normalizeImageUrls(issue.imageUrls ?? [])
    .map((url) => chunkImageUrls.indexOf(url) + 1)
    .filter((index) => index > 0);
  const imageSuffix = imageIndexes.length > 0 ? `（对应图片：${formatImageIndexes(imageIndexes)}）` : "";
  return `${issueNumber}. ${issue.title}${imageSuffix}`;
}

function buildDescription(
  chunk: RectificationIssueSelection[],
  allIssues: RectificationIssueSelection[],
  note: string,
  chunkImageUrls: string[]
): string {
  const issueSection = chunk.map((issue) => buildIssueLine(issue, allIssues, chunkImageUrls)).join("\n");
  const normalizedNote = note.trim();
  if (!issueSection) {
    if (!normalizedNote) {
      return EMPTY_ISSUE_FALLBACK_DESCRIPTION;
    }
    return `复核备注：${normalizedNote}`;
  }
  if (!normalizedNote) {
    return issueSection;
  }
  return `${issueSection}\n\n复核备注：${normalizedNote}`;
}

export function buildRectificationPreviewOrders(input: {
  selectedIssues: RectificationIssueSelection[];
  note: string;
  shouldCorrected: string;
  imageUrls: string[];
  maxLength: number;
}): RectificationPreviewOrder[] {
  const normalizedIssues = normalizeIssues(input.selectedIssues);
  const normalizedNote = String(input.note || "").trim();
  const normalizedImageUrls = normalizeImageUrls(input.imageUrls);
  const maxLength = Math.max(1, Math.floor(Number(input.maxLength) || 0));
  if (normalizedIssues.length === 0) {
    const description = buildDescription([], [], normalizedNote, normalizedImageUrls);
    if (description.length > maxLength) {
      throw new RectificationPreviewError(`复核备注已超过 ${maxLength} 字，无法创建整改单。`);
    }
    return [
      {
        description,
        issueCount: 0,
        selectedIssues: [],
        imageUrls: normalizedImageUrls,
        shouldCorrected: input.shouldCorrected
      }
    ];
  }

  const chunks: RectificationIssueSelection[][] = [];
  let currentChunk: RectificationIssueSelection[] = [];

  normalizedIssues.forEach((issue) => {
    const candidateChunk = [...currentChunk, issue];
    const candidateImageUrls = buildChunkImageUrls(candidateChunk, normalizedImageUrls);
    const candidateDescription = buildDescription(candidateChunk, normalizedIssues, normalizedNote, candidateImageUrls);

    if (candidateDescription.length <= maxLength) {
      currentChunk = candidateChunk;
      return;
    }

    if (currentChunk.length === 0) {
      throw new RectificationPreviewError(`问题“${issue.title}”拼接备注后已超过 ${maxLength} 字，无法自动拆单。`);
    }

    chunks.push(currentChunk);
    currentChunk = [issue];
    const nextImageUrls = buildChunkImageUrls(currentChunk, normalizedImageUrls);
    const nextDescription = buildDescription(currentChunk, normalizedIssues, normalizedNote, nextImageUrls);
    if (nextDescription.length > maxLength) {
      throw new RectificationPreviewError(`问题“${issue.title}”拼接备注后已超过 ${maxLength} 字，无法自动拆单。`);
    }
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks.map((chunk) => {
    const chunkImageUrls = buildChunkImageUrls(chunk, normalizedImageUrls);
    return {
      description: buildDescription(chunk, normalizedIssues, normalizedNote, chunkImageUrls),
      issueCount: chunk.length,
      selectedIssues: chunk,
      imageUrls: chunkImageUrls,
      shouldCorrected: input.shouldCorrected
    };
  });
}
