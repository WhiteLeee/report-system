## Summary

- Describe what changed and why.

## UI Boundary Checklist (Required)

- [ ] I did not directly import `recharts`, `lucide-react`, `react-day-picker`, or `@radix-ui/*` in `app/` or `ui/`.
- [ ] I used `@/components/ui/*` wrappers for UI primitives and chart/icon/calendar dependencies.
- [ ] `npm run check:ui-imports` passes locally.
- [ ] `npm run typecheck` passes locally.

## Exceptions (If Any)

- If any rule must be bypassed, explain the reason, scope, and rollback plan.
