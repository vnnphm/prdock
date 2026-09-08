import request from "supertest"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "../../src/api/app.js"
import { prisma } from "../../src/db/prisma.js"


beforeEach(async () => {
  await prisma.gitHubWebhookEvent.deleteMany()
  await prisma.deployment.deleteMany()
})

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
  })

  it("updates the same deployment when a new commit is pushed", async () => {
    const existingDeployment = await prisma.deployment.create({
      data: {
        repoFullName: "vinny/test-repo",
        prNumber: 42,
        commitSha: "oldsha",
        status: "READY",
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
  });

})
