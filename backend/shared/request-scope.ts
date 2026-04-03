import { and, eq } from "drizzle-orm";

import type { RequestContext } from "@/backend/auth/request-context";
import { db } from "@/backend/database/client";
import { organizationMasterTable, storeMasterProfileTable } from "@/backend/database/schema";

export type ScopeValues = Pick<RequestContext, "enterpriseScopeIds" | "organizationScopeIds" | "storeScopeIds">;

export function normalizeScopeIds(values: string[] | undefined): string[] {
  return Array.from(new Set((values || []).map((item) => item.trim()).filter(Boolean)));
}

export function canAccessEnterprise(scope: ScopeValues, enterpriseId: string): boolean {
  const enterpriseScopeIds = normalizeScopeIds(scope.enterpriseScopeIds);
  if (enterpriseScopeIds.length === 0) {
    return true;
  }
  return enterpriseScopeIds.includes(enterpriseId);
}

export function resolveStoreIdsFromScope(scope: ScopeValues, enterpriseId?: string): string[] | null {
  const storeScopeIds = normalizeScopeIds(scope.storeScopeIds);
  if (storeScopeIds.length > 0) {
    return storeScopeIds;
  }

  const organizationScopeIds = normalizeScopeIds(scope.organizationScopeIds);
  if (organizationScopeIds.length === 0) {
    return null;
  }

  const organizationWhere = [eq(organizationMasterTable.isActive, 1)];
  if (enterpriseId) {
    organizationWhere.push(eq(organizationMasterTable.enterpriseId, enterpriseId));
  }
  const organizationRows = db
    .select({
      enterpriseId: organizationMasterTable.enterpriseId,
      organizeCode: organizationMasterTable.organizeCode,
      parentCode: organizationMasterTable.parentCode
    })
    .from(organizationMasterTable)
    .where(and(...organizationWhere))
    .all()
    .filter((row) => canAccessEnterprise(scope, row.enterpriseId));

  const childrenMap = new Map<string, string[]>();
  organizationRows.forEach((row) => {
    const parentCode = String(row.parentCode || "").trim();
    if (!childrenMap.has(parentCode)) {
      childrenMap.set(parentCode, []);
    }
    childrenMap.get(parentCode)?.push(row.organizeCode);
  });

  const allowedOrganizationCodes = new Set<string>();
  const queue = [...organizationScopeIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || allowedOrganizationCodes.has(current)) {
      continue;
    }
    allowedOrganizationCodes.add(current);
    (childrenMap.get(current) || []).forEach((childCode) => queue.push(childCode));
  }

  if (allowedOrganizationCodes.size === 0) {
    return [];
  }

  const storeWhere = [eq(storeMasterProfileTable.isActive, 1)];
  if (enterpriseId) {
    storeWhere.push(eq(storeMasterProfileTable.enterpriseId, enterpriseId));
  }

  return Array.from(
    new Set(
      db
        .select({
          enterpriseId: storeMasterProfileTable.enterpriseId,
          storeId: storeMasterProfileTable.storeId,
          organizeCode: storeMasterProfileTable.organizeCode
        })
        .from(storeMasterProfileTable)
        .where(and(...storeWhere))
        .all()
        .filter(
          (row) =>
            canAccessEnterprise(scope, row.enterpriseId) &&
            allowedOrganizationCodes.has(String(row.organizeCode || "").trim())
        )
        .map((row) => row.storeId)
    )
  );
}

export function resolveScopedStoreIds(context: RequestContext, enterpriseId?: string): string[] | null {
  return resolveStoreIdsFromScope(context, enterpriseId);
}

export function intersectScopedIds(left: string[] | null, right: string[] | null): string[] | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}
