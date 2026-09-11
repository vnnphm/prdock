[PLANS]
- 2026-09-11T21:48Z [USER] Implement approved deployment lifecycle extraction; run expanded tests and TypeScript build in containers.

[DECISIONS]
- 2026-09-11T21:48Z [USER] Move the PR-action switch into deployment-service; deployment-repo owns deployment queries. Preserve lifecycle behavior, event recording, and queue contracts.
- 2026-09-11T21:48Z [CODE] Closing marks DELETING without deleting the row. No schema or queue reliability redesign in this refactor.

[PROGRESS]
- 2026-09-11T21:48Z [TOOL] Existing user changes include GitHub/queue/worker moves and test/package edits; preserve them.
- 2026-09-11T21:52Z [CODE] Extracted lifecycle switch and deployment queries into service/repo; repaired three stale imports. Added Compose tooling, guarded isolated DB tests, build script, and documented commands in AGENTS.md.

[DISCOVERIES]
- 2026-09-11T21:48Z [TOOL] Baseline: two suites fail during import; TypeScript reports three stale import paths. Deployment modules were empty. No build/lint scripts or Node container workflow existed.
- 2026-09-11T21:52Z [CODE] Queue sender currently constructs a command without sending it; unchanged prototype limitation outside this refactor. Tests mock publication at the queue boundary.

[OUTCOMES]
- 2026-09-11T23:00Z [CODE] Added root multi-stage Node 22 Dockerfile: compile TypeScript, prune dev dependencies, run dist/src/server.js as node on port 3000. Runtime usage and separate migrations documented in AGENTS.md; existing user changes preserved.
- 2026-09-11T23:00Z [TOOL] Built prdock:local successfully; network-disabled runtime smoke check returned healthy with uid=1000. Container suite passed all 12 tests and TypeScript build. No lint configured. Removed disposable postgres-test container.
- 2026-09-11T22:58Z [TOOL] Reviewed preview script/workflow without source edits: workflow uses nonexistent scripts/entrypoint.sh; actual src/scripts/entrypoint.sh lacks executable permission; default Dockerfile absent; required image_tag input ignored. GitHub read-only lookup returns workflow absent on default branch. No real ECR push attempted; IAM/repository configuration unverified.
- 2026-09-11T22:58Z [TOOL] Container checks: 12 tests and TypeScript build pass; shell syntax passes. Mock script checks confirm success and missing-tag/login/build/push failure handling, but AWS failure is masked if docker login succeeds. No lint configured.
- 2026-09-11T21:52Z [TOOL] Completed: Compose tooling applied the committed migration to isolated PostgreSQL; both suites passed (12 tests), npm run build passed, Compose config and git diff --check passed. Lint unavailable (no configuration). Disposable test DB removed; development DB untouched.
