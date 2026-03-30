export interface RequestContext {
  tenantId?: string;
  userId?: string;
  scopes?: string[];
  roleCodes?: string[];
  enterpriseScopeIds?: string[];
  organizationScopeIds?: string[];
  storeScopeIds?: string[];
}
