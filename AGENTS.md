# prdock

## Purpose and MVP
prdock gives GitHub pull requests live preview environments so reviewers can test changes without running the project locally.

The MVP supports an opted-in repository with a Dockerfile: open a PR, build its exact commit in GitHub Actions, deploy it to ECS/Fargate, expose a preview URL, update it on new commits, and remove its runtime resources when the PR closes or merges.

## Core principle
**One repository + PR → one logical Deployment → one preview environment.**

- Enforce uniqueness on `(repoFullName, prNumber)`.
- New commits update the existing Deployment; they do not create another logical deployment or URL.
- Reopening reuses the Deployment record and recreates runtime resources if needed.
- PostgreSQL holds desired state. The latest accepted PR head commit wins; queue arrival order does not.

## Architecture
**Current, as discussed:** Express webhook API → PostgreSQL → SQS Standard → worker. Worker polling and job processing are the prototype focus; Docker/ECR/ECS execution is not established as implemented. Verify the repository before claiming otherwise.

**Target:**
1. GitHub webhook records PR state and its current commit in PostgreSQL.
2. GitHub Actions builds that commit and pushes its image to ECR.
3. An authenticated build callback is validated by prdock and queues deployment work.
4. The worker creates/updates the ECS/Fargate preview and saves runtime state and URL.
5. PR closure queues cleanup; the worker removes the preview resources.

GitHub Actions owns image builds. prdock owns deployment state, queueing, runtime provisioning, retries, and cleanup. Do not add Docker builds to the worker.

## Tech stack
- TypeScript, Node.js, Express; Zod for runtime validation.
- Prisma 7 and PostgreSQL for persistence.
- AWS SDK v3; SQS Standard with a dead-letter queue (DLQ), ECR, ECS/Fargate.
- Docker and GitHub Actions for builds; Docker Compose for local services.
- Vitest for tests and Supertest for HTTP integration tests.

## Data model
These are model responsibilities, not a verified copy of the Prisma schema. Preserve existing names where possible.

- **Deployment:** `id`, `repoFullName`, `prNumber`, current desired `commitSha`, lifecycle `status`, optional `imageUri`, `serviceArn`, `previewUrl`, `errorMessage`, and timestamps. Retain whether the PR wants an active preview, including during cleanup. One row per repo + PR, not per commit.
- **GitHubWebhookEvent:** unique `githubDeliveryId` from `X-GitHub-Delivery`, event type/action, processing outcome, timestamps, and enough context to associate it with the PR/Deployment. Track unfinished handling so retries can resume safely.
- Keep statuses simple: waiting/building, queued/deploying, ready, failed, deleting/deleted. Reuse existing enums; do not create a separate model for every lifecycle step.

## Webhooks and validation
- Verify the GitHub webhook signature against the raw request body before processing it.
- Use Zod at boundaries: environment variables, webhook headers/payloads, build callbacks, and parsed SQS messages. Infer TypeScript types from schemas; do not trust type assertions as validation.
- Handle `pull_request` actions: `opened` creates/upserts desired state; `synchronize` updates the desired commit; `reopened` reactivates the same Deployment; `closed` requests cleanup, including merged PRs. Acknowledge unsupported events without side effects.
- Deduplicate using the database unique constraint on `githubDeliveryId`, not only a read-before-write check. Duplicate deliveries must not repeat completed state changes.
- Keep event recording and Deployment changes transactional. A database commit and SQS send are not atomic: retain retryable pending work if publication fails; never mark an event complete before its required work is durably handed off.
- Delivery IDs identify duplicates, not chronology. Do not let a delayed webhook blindly replace newer PR state; reconcile against GitHub's current PR head/state when ordering is uncertain.

## GitHub Actions build contract
- Participating repositories need a Dockerfile, a workflow, scoped ECR push permissions, and authenticated access to prdock.
- The workflow obtains the existing `deploymentId` from prdock for its repo + PR and confirms the expected `commitSha`; do not invent IDs or race the webhook by creating a second Deployment.
- Checkout the exact PR head `commitSha`, not a moving branch or GitHub's default synthetic merge commit.
- Build the Docker image, push to ECR with an immutable commit-specific reference (prefer a digest), then notify prdock with `{ deploymentId, commitSha, imageUri }`.
- Authenticate the callback, authorize its Deployment/repository, and validate that `imageUri` belongs to the allowed ECR registry/repository.
- Reject stale callbacks when `commitSha !== Deployment.commitSha` or the PR no longer wants an active preview. Duplicate accepted callbacks must be safe and must not regress state.
- Keep build failures distinct from runtime deployment failures. Never label a preview READY merely because an image was pushed.
- Use least-privilege credentials, preferably GitHub OIDC for AWS. MVP builds are for trusted opted-in repositories; never expose privileged build credentials to untrusted fork code.

## Queue and worker
- Jobs carry `deploymentId`, `commitSha`, and an action such as `DEPLOY` or `DESTROY`; validate them with Zod.
- SQS Standard can duplicate and reorder messages. Load current Deployment state and skip stale deploy jobs whose SHA no longer matches or whose preview is closed.
- Guard transitions with conditional database updates using the expected SHA and lifecycle state. Recheck before runtime mutations and final state writes; a single early SHA check is insufficient.
- Guard cleanup against reopened PRs. SHA alone cannot distinguish close/reopen cycles at the same commit; use lifecycle state and, when necessary, a small generation/version field to prevent obsolete work acting on the new lifecycle.
- Keep operations retry-safe. Coordinate mutations per Deployment so overlapping jobs cannot let an older operation replace or delete newer runtime resources.
- Worker responsibilities: long-poll SQS, validate jobs, load/claim current work, create/update ECS services, wait for health, persist resource identifiers/status/URL, and clean up resources on closure.
- Delete messages only after success or an intentional safe no-op. Leave failed work for retry; configure bounded retries into the DLQ and extend visibility for long operations.
- Log `deploymentId`, `commitSha`, action, and useful errors; never log secrets. Separate SQS mechanics from deployment orchestration.

## Development commands
Expected command contract; check `package.json` and Compose configuration before running. These names are not verified existing scripts.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API in watch mode |
| `npm run dev:worker` | Start the worker in watch mode, when implemented |
| `npm test` | Run Vitest once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:up` | Start local PostgreSQL through Docker Compose |
| `npm run db:down` | Stop local PostgreSQL without deleting its data volume |
| `npx prisma generate` | Generate the Prisma client |
| `npx prisma migrate dev --name <name>` | Create/apply a local development migration |
| `npx prisma migrate deploy` | Apply committed migrations in deployment environments |

Use the repository's container workflow for Node tooling and local dependencies. If absent when implementing code, add a minimal Docker/Compose workflow; do not install host system packages. Keep Prisma 7 configuration consistent with the repository and commit schema migrations.

## Container tooling

- Build the API runtime image with `docker build -t prdock:local .`. The multi-stage Dockerfile compiles the checked-in Prisma client and TypeScript with Node 22, then runs the compiled API as the non-root `node` user with production dependencies only.
- Run with `docker run --rm --env-file .env -p 3000:3000 prdock:local`. Supply `AWS_REGION`, `DATABASE_URL`, and `SQS_QUEUE_URL` as appropriate for the configured services; database/queue addresses must be reachable from the container. `PORT` defaults to 3000; adjust the port mapping if overridden. Check `GET /health` after startup.
- Apply database migrations separately using the existing Prisma tooling before serving database-backed requests; the runtime image does not contain the Prisma CLI or run migrations on startup. Secrets are supplied at runtime and excluded from the build context by `.dockerignore`.

- Run `docker compose --profile tooling run --build --rm tooling` for the complete check: install locked Node dependencies in the image, apply committed migrations to the isolated test database, run `npm test`, and compile with `npm run build`.
- The tooling image uses Node 22 and the checked-in generated Prisma client. Dependency lifecycle scripts are disabled during installation to avoid skill synchronization in the image. Rebuild after source or dependency changes.
- `postgres-test` uses an ephemeral filesystem, has no host port, and is separate from development PostgreSQL and its volume. Integration tests require a database named `prdock_test` before deleting fixtures. Queue publication is mocked in HTTP tests.
- Integration tests alone: `docker compose --profile tooling run --build --rm tooling sh -c 'npx --no-install prisma migrate deploy --config prisma7.config.ts && npm run test:integration'`.
- Compilation alone: `docker compose --profile tooling run --build --rm --no-deps tooling npm run build`. Build output stays inside the disposable container.
- Remove the disposable test database after checks with `docker compose --profile tooling rm --stop --force postgres-test`. This does not remove the development database.
- No linter is configured; report lint as unavailable rather than claiming a lint pass.

## Deployment module boundaries

- `src/github/process-github-event.ts` owns delivery deduplication, webhook-event recording, and queue publication.
- `src/deployments/deployment-service.ts` owns the PR-action switch through `applyPullRequestAction`, returning a deployment or `null` when a synchronize/close event has no deployment.
- `src/deployments/deployment-repo.ts` owns the service's deployment lookups, creation, and updates. Closing sets `DELETING`; reopening reuses the record, queues the incoming SHA, and clears the error. An opened event leaves an existing deployment unchanged.
- These boundaries preserve prototype behavior; transactional deduplication, reliable queue publication, and runtime provisioning remain separate work.

## Testing expectations
- Unit-test focused services with Vitest; test HTTP validation and responses with Supertest.
- Cover all four PR actions, invalid signatures/payloads, duplicate delivery IDs, stale jobs/callbacks, closed/reopened races, retry-safe cleanup, and failed queue publication.
- Test database uniqueness and conditional updates against isolated PostgreSQL; mock AWS/GitHub boundaries in routine tests. No real cloud resources in the default suite.
- Confirm runtime health before READY. Test that old successes or failures cannot overwrite the current commit's state.
- Run applicable tests, build/typecheck, and lint before completion using existing scripts; report anything not run. Do not fix unrelated failures.

## Implementation boundaries
- Keep routes thin: authenticate, validate, call a focused service, return a response.
- Keep services focused on webhook handling, build callbacks, deployment processing, and cleanup. Extract helpers when they remove real duplication, not to anticipate hypothetical use cases.
- Prefer small functions, explicit state transitions, and direct Prisma/AWS SDK calls over generic frameworks or repository layers.
- MVP non-goals: dashboard, billing, multi-tenant SaaS onboarding, Kubernetes/multi-cloud, automatic Dockerfile generation, arbitrary untrusted builds, per-preview databases, deployment history/rollback engines, and elaborate GitHub comment/check automation.
- Avoid the feature vacuum: finish the open → update → close preview lifecycle before adding adjacent features. Do not introduce unnecessary abstractions, infrastructure, or dependencies.
