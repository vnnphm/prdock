import type { GitHubPullRequestEvent } from "../schemas/github-webhook.js";
import { prisma } from "../db/prisma.js";
import { sendDeploymentJob } from "../queue/deployment-queue.js";
import { applyPullRequestAction } from "../deployments/deployment-service.js";



export async function processGitHubEvent(event: GitHubPullRequestEvent) {


  const existingEvent = await prisma.gitHubWebhookEvent.findUnique({
    where: {
      githubDeliveryId: event.githubDeliveryId,
    },
  })


  if (existingEvent) {
    return
  }



  const deployment = await applyPullRequestAction(event);

  if (!deployment) {
    return
  }

  //save event data in postgres db

  await prisma.gitHubWebhookEvent.create({
    data: {
      githubDeliveryId: event.githubDeliveryId,
      eventName: event.eventName,
      action: event.action,
      repoFullName: event.repoFullName,
      prNumber: event.prNumber,
      commitSha: event.commitSha,
      deploymentId: deployment.id
    }
  })


  if (event.action === "closed") {
    await sendDeploymentJob({
      version: 1,
      deploymentId: deployment.id,
      action: "DESTROY",
    });

    return;
  }

  await sendDeploymentJob({
    version: 1,
    deploymentId: deployment.id,
    commitSha: event.commitSha,
    action: "DEPLOY",
  });



}
