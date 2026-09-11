[PLANS]
- 2026-09-11T21:48Z [USER] Implement approved deployment lifecycle extraction; run expanded tests and TypeScript build in containers.

[DECISIONS]
- 2026-09-11T23:17Z [USER] ECR push must use ECR_REPO_URL from env; never print env contents/values or modify env file. Do not create a repository. Supersedes earlier hardcoded target plan.
- 2026-09-11T21:48Z [USER] Move the PR-action switch into deployment-service; deployment-repo owns deployment queries. Preserve lifecycle behavior, event recording, and queue contracts.
- 2026-09-11T21:48Z [CODE] Closing marks DELETING without deleting the row. No schema or queue reliability redesign in this refactor.

[PROGRESS]
- 2026-09-11T21:48Z [TOOL] Existing user changes include GitHub/queue/worker moves and test/package edits; preserve them.
- 2026-09-11T21:52Z [CODE] Extracted lifecycle switch and deployment queries into service/repo; repaired three stale imports. Added Compose tooling, guarded isolated DB tests, build script, and documented commands in AGENTS.md.

[DISCOVERIES]
- 2026-09-11T21:48Z [TOOL] Baseline: two suites fail during import; TypeScript reports three stale import paths. Deployment modules were empty. No build/lint scripts or Node container workflow existed.
- 2026-09-11T21:52Z [CODE] Queue sender currently constructs a command without sending it; unchanged prototype limitation outside this refactor. Tests mock publication at the queue boundary.

[OUTCOMES]
- 2026-09-11T23:40Z [TOOL] Reran workflow 34658022988 (attempt 2). Configure AWS credentials now attempts OIDC but fails: "Not authorized to perform sts:AssumeRoleWithWebIdentity". ECR login/build/push skipped. Supersedes missing-credentials symptom in attempt 1; AWS role trust/configuration needs inspection. No env or IAM changes made.
- 2026-09-11T23:27Z [TOOL] Dispatched build-preview.yml on main after dry-run request preview. Run 34658022988 failed at Configure AWS credentials: "Could not load credentials from any providers". Repository secret list empty; workflow references secrets.AWS_ROLE_ARN. ECR login/build/push skipped. User must configure an appropriate GitHub OIDC role ARN secret before auth can be retested; no AWS/IAM or env changes made.
- 2026-09-11T23:20Z [TOOL] ECR_REPO_URL now present. Configured repository lookup and mocked script dry run passed; actual scripts/entrypoint.sh completed ECR login/build/push. Remote describe-images verified tag push-check-20260911T231830Z, digest sha256:950bc4371b97a1ebd5e372c67fd8a8f53b0a6678352393647918c407c15e88d0. Env values suppressed and file hash unchanged. Local AWS push verified; GitHub OIDC workflow remains untested.
- 2026-09-11T23:17Z [TOOL] AWS reauthentication succeeded. Requested repository creation was aborted. Push helper /tmp/prdock-ecr-push-check.py reads env privately, mocks dry run, captures output, then can push a unique tag and verify digest. Currently blocked: saved workspace .env does not contain ECR_REPO_URL (also absent in process environment); only .env found. No image pushed; env untouched. Await user saving variable or identifying another env file.
- 2026-09-11T23:05Z [USER] Authorized attempting ECR push. [TOOL] Local AWS session expired; started `aws login` (pending browser sign-in, exec session 78350). Remote workflow still invokes non-executable script directly; sh fix is local only. No image pushed. Resume after sign-in: confirm AWS identity and us-west-2 prdock-preview repository, dry-run push command, then attempt authorized push and verify digest. Current HEAD 92625f7c6a562f0b7a591b4cd1a34a14a957c5ed.
- 2026-09-11T23:04Z [USER] Changed workflow invocation to `sh scripts/entrypoint.sh`, resolving executable-permission blocker. [TOOL] Shell syntax and git diff --check pass; no application source changes, so prior tests/build were not repeated. No remote run or ECR push performed.
- 2026-09-11T23:04Z [TOOL] Recheck supersedes 22:58 review: script moved to correct scripts/entrypoint.sh path; root Dockerfile builds successfully; GitHub workflow lookup succeeds but returns no runs. Script remains committed as 100644 and direct invocation fails with exit 126 (permission denied). Ignored image_tag input and login pipeline unchanged. All 12 tests, TypeScript build, and shell syntax pass; real ECR push and AWS configuration remain unverified.
- 2026-09-11T23:00Z [CODE] Added root multi-stage Node 22 Dockerfile: compile TypeScript, prune dev dependencies, run dist/src/server.js as node on port 3000. Runtime usage and separate migrations documented in AGENTS.md; existing user changes preserved.
- 2026-09-11T23:00Z [TOOL] Built prdock:local successfully; network-disabled runtime smoke check returned healthy with uid=1000. Container suite passed all 12 tests and TypeScript build. No lint configured. Removed disposable postgres-test container.
- 2026-09-11T22:58Z [TOOL] Reviewed preview script/workflow without source edits: workflow uses nonexistent scripts/entrypoint.sh; actual src/scripts/entrypoint.sh lacks executable permission; default Dockerfile absent; required image_tag input ignored. GitHub read-only lookup returns workflow absent on default branch. No real ECR push attempted; IAM/repository configuration unverified.
- 2026-09-11T22:58Z [TOOL] Container checks: 12 tests and TypeScript build pass; shell syntax passes. Mock script checks confirm success and missing-tag/login/build/push failure handling, but AWS failure is masked if docker login succeeds. No lint configured.
- 2026-09-11T21:52Z [TOOL] Completed: Compose tooling applied the committed migration to isolated PostgreSQL; both suites passed (12 tests), npm run build passed, Compose config and git diff --check passed. Lint unavailable (no configuration). Disposable test DB removed; development DB untouched.
