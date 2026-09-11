import request from "supertest"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { app } from "../../src/api/app.js"
import { prisma } from "../../src/db/prisma.js"
import { sendDeploymentJob } from "../../src/queue/deployment-queue.js"
import type { GitHubPullRequestEvent } from "../../src/schemas/github-webhook.js"

vi.mock("../../src/queue/deployment-queue.js", () => ({
  sendDeploymentJob: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== "/prdock_test") {
    throw new Error("Integration tests require the isolated prdock_test database; use the Compose tooling service.")
  }
  vi.clearAllMocks()
  await prisma.gitHubWebhookEvent.deleteMany()
  await prisma.deployment.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})

function sendPullRequest(action: GitHubPullRequestEvent["action"], deliveryId: string, commitSha = "abc123") {
  return request(app)
    .post("/webhooks/github")
    .set("x-github-delivery", deliveryId)
    .set("x-github-event", "pull_request")
    .send({
      action,
      repository: { full_name: "vinny/test-repo" },
      pull_request: { number: 42, head: { sha: commitSha } },
    })
}

describe("POST /webhooks/github", () => {
  it("creates a deployment and webhook event when a PR is opened.", async () => {
    const response = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "delivery-123")
      .set("x-github-event", "pull_request")
      .send({
        action: "opened",
        repository: {
          full_name: "vinny/test-repo",
        },
        pull_request: {
          number: 42,
          head: {
            sha: "abc123"
          },
        },
      })


    expect(response.status).toBe(200)

    const deployment = await prisma.deployment.findUnique({
      where: {
        repoFullName_prNumber: {
          repoFullName: "vinny/test-repo",
          prNumber: 42,
        },
      },
    })

    expect(deployment).not.toBeNull()
    expect(deployment?.commitSha).toBe("abc123")
    expect(deployment?.status).toBe("QUEUED")


    const webhookEvent = await prisma.gitHubWebhookEvent.findUnique({
      where:
      {
        githubDeliveryId: "delivery-123",
      },
    })


    expect(webhookEvent).not.toBeNull()
    expect(webhookEvent?.action).toBe("opened")
    expect(webhookEvent?.deploymentId).toBe(deployment?.id)
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1,
      action: "DEPLOY",
      deploymentId: deployment?.id,
      commitSha: "abc123",
    })
  })

  it("updates the same deployment when a new commit is pushed", async () => {
    const existingDeployment = await prisma.deployment.create({
      data: {
        repoFullName: "vinny/test-repo",
        prNumber: 42,
        commitSha: "oldsha",
        status: "READY",
        errorMessage: "previous error",
      },
    });

    const response = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "delivery-456")
      .set("x-github-event", "pull_request")
      .send({
        action: "synchronize",
        repository: {
          full_name: "vinny/test-repo",
        },
        pull_request: {
          number: 42,
          head: {
            sha: "newsha",
          },
        },
      });

    expect(response.status).toBe(200);

    const updatedDeployment = await prisma.deployment.findUnique({
      where: {
        repoFullName_prNumber: {
          repoFullName: "vinny/test-repo",
          prNumber: 42,
        },
      },
    });

    expect(updatedDeployment?.id).toBe(existingDeployment.id);
    expect(updatedDeployment?.commitSha).toBe("newsha");
    expect(updatedDeployment?.status).toBe("QUEUED");
    expect(updatedDeployment?.errorMessage).toBe("previous error");
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1,
      action: "DEPLOY",
      deploymentId: existingDeployment.id,
      commitSha: "newsha",
    });

    const count = await prisma.deployment.count();

    expect(count).toBe(1);
  });

  it("marks the deployment as deleting when the PR closes", async () => {
    await prisma.deployment.create({
      data: {
        repoFullName: "vinny/test-repo",
        prNumber: 42,
        commitSha: "abc123",
        status: "READY",
      },
    });

    const response = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "delivery-close")
      .set("x-github-event", "pull_request")
      .send({
        action: "closed",
        repository: {
          full_name: "vinny/test-repo",
        },
        pull_request: {
          number: 42,
          head: {
            sha: "abc123",
          },
        },
      });

    expect(response.status).toBe(200);

    const deployment = await prisma.deployment.findUnique({
      where: {
        repoFullName_prNumber: {
          repoFullName: "vinny/test-repo",
          prNumber: 42,
        },
      },
    });

    expect(deployment?.status).toBe("DELETING");
    expect(deployment?.commitSha).toBe("abc123");
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1,
      action: "DESTROY",
      deploymentId: deployment?.id,
    });
  });

  it("returns 400 when required GitHub data is missing", async () => {
    const response = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "bad-event")
      .set("x-github-event", "pull_request")
      .send({
        action: "opened",
      });

    expect(response.status).toBe(400);
    expect(sendDeploymentJob).not.toHaveBeenCalled();
    expect(await prisma.deployment.count()).toBe(0);
    expect(await prisma.gitHubWebhookEvent.count()).toBe(0);
  });


  it("ignores duplicate GitHub delivery ids", async () => {
    const payload = {
      action: "opened",
      repository: {
        full_name: "vinny/test-repo",
      },
      pull_request: {
        number: 42,
        head: {
          sha: "abc123",
        },
      },
    };

    const firstResponse = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "delivery-123")
      .set("x-github-event", "pull_request")
      .send(payload);

    const secondResponse = await request(app)
      .post("/webhooks/github")
      .set("x-github-delivery", "delivery-123")
      .set("x-github-event", "pull_request")
      .send(payload);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const eventCount =
      await prisma.gitHubWebhookEvent.count({
        where: {
          githubDeliveryId: "delivery-123",
        },
      });

    expect(eventCount).toBe(1);

    const deploymentCount =
      await prisma.deployment.count({
        where: {
          repoFullName: "vinny/test-repo",
          prNumber: 42,
        },
      });

    expect(deploymentCount).toBe(1);
    expect(sendDeploymentJob).toHaveBeenCalledTimes(1);
  });

  it("keeps an existing deployment unchanged on another opened delivery", async () => {
    const existing = await prisma.deployment.create({
      data: {
        repoFullName: "vinny/test-repo",
        prNumber: 42,
        commitSha: "current-sha",
        status: "READY",
        errorMessage: "previous error",
      },
    })

    expect((await sendPullRequest("opened", "another-open", "incoming-sha")).status).toBe(200)
    expect(await prisma.deployment.findUnique({ where: { id: existing.id } })).toEqual(existing)
    expect(await prisma.deployment.count()).toBe(1)
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1, action: "DEPLOY", deploymentId: existing.id, commitSha: "incoming-sha",
    })
  })

  it("creates a queued deployment when a missing PR is reopened", async () => {
    expect((await sendPullRequest("reopened", "reopen-missing")).status).toBe(200)
    const deployment = await prisma.deployment.findFirstOrThrow()
    expect(deployment).toMatchObject({ commitSha: "abc123", status: "QUEUED", errorMessage: null })
    expect(await prisma.gitHubWebhookEvent.findUnique({ where: { githubDeliveryId: "reopen-missing" } }))
      .toMatchObject({ action: "reopened", deploymentId: deployment.id })
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1, action: "DEPLOY", deploymentId: deployment.id, commitSha: "abc123",
    })
  })

  it.each(["synchronize", "closed"] as const)("ignores %s when no deployment exists", async (action) => {
    expect((await sendPullRequest(action, `missing-${action}`)).status).toBe(200)
    expect(await prisma.deployment.count()).toBe(0)
    expect(await prisma.gitHubWebhookEvent.count()).toBe(0)
    expect(sendDeploymentJob).not.toHaveBeenCalled()
  })

  it("retains one deployment through open, update, close, and reopen", async () => {
    expect((await sendPullRequest("opened", "lifecycle-open", "first-sha")).status).toBe(200)
    const original = await prisma.deployment.findFirstOrThrow()
    expect((await sendPullRequest("synchronize", "lifecycle-update", "second-sha")).status).toBe(200)
    expect((await sendPullRequest("closed", "lifecycle-close", "different-close-sha")).status).toBe(200)
    expect(await prisma.deployment.findUnique({ where: { id: original.id } }))
      .toMatchObject({ status: "DELETING", commitSha: "second-sha" })

    await prisma.deployment.update({ where: { id: original.id }, data: { errorMessage: "cleanup failed" } })
    expect((await sendPullRequest("reopened", "lifecycle-reopen", "third-sha")).status).toBe(200)
    expect(await prisma.deployment.findUnique({ where: { id: original.id } }))
      .toMatchObject({ status: "QUEUED", commitSha: "third-sha", errorMessage: null })
    expect(await prisma.deployment.count()).toBe(1)
    expect(await prisma.gitHubWebhookEvent.count({ where: { deploymentId: original.id } })).toBe(4)
    expect(vi.mocked(sendDeploymentJob).mock.calls.map(([job]) => job)).toEqual([
      { version: 1, action: "DEPLOY", deploymentId: original.id, commitSha: "first-sha" },
      { version: 1, action: "DEPLOY", deploymentId: original.id, commitSha: "second-sha" },
      { version: 1, action: "DESTROY", deploymentId: original.id },
      { version: 1, action: "DEPLOY", deploymentId: original.id, commitSha: "third-sha" },
    ])
  })

  it("reactivates a deleted deployment at the same commit", async () => {
    const existing = await prisma.deployment.create({
      data: {
        repoFullName: "vinny/test-repo", prNumber: 42, commitSha: "abc123",
        status: "DELETED", errorMessage: "previous error",
      },
    })
    expect((await sendPullRequest("reopened", "reopen-deleted")).status).toBe(200)
    expect(await prisma.deployment.findUnique({ where: { id: existing.id } }))
      .toMatchObject({ status: "QUEUED", commitSha: "abc123", errorMessage: null })
    expect(await prisma.deployment.count()).toBe(1)
    expect(sendDeploymentJob).toHaveBeenCalledExactlyOnceWith({
      version: 1, action: "DEPLOY", deploymentId: existing.id, commitSha: "abc123",
    })
  })

})
