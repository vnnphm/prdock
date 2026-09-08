import type { GitHubPullRequestEvent } from "../schemas/github-webhook.js";
import { prisma } from "../db/prisma.js";



export async function processGitHubEvent(event: GitHubPullRequestEvent) {
  let deployment = await prisma.deployment.findUnique({
    where: {
      repoFullName_prNumber: {
        repoFullName: event.repoFullName,
        prNumber: event.prNumber
      },
    },
  })

  //switch case since action can only be those enums

  switch (event.action) {
    case "opened":
      if (!deployment) {
        deployment = await prisma.deployment.create({
          data: {
            repoFullName: event.repoFullName,
            prNumber: event.prNumber,
            commitSha: event.commitSha,
            status: "QUEUED",
          },
        })

      }
      break



    case "synchronize":
      if (deployment) {
        deployment = await prisma.deployment.update({
          where: {
            id: deployment.id
          },
            data: {
              commitSha: event.commitSha,
              status: "QUEUED"
            },
        })
      }
      break

    case "reopened":
    if (!deployment) {
      deployment = await prisma.deployment.create({
        data: {
          repoFullName: event.repoFullName,
          prNumber: event.prNumber,
          commitSha: event.commitSha,
          status: "QUEUED",
        },
      })

    }

    else {
      deployment = await prisma.deployment.update({
        where: {
          id: deployment.id,
        },
        data: {
          commitSha: event.commitSha,
          status: "QUEUED",
          errorMessage: null
        },

      })
      }

      break

    case "closed":
      if (deployment) {
        deployment = await prisma.deployment.update({
          where: {
            id: deployment.id,
          },
          data: {
            status: "DELETING"
          }
        })
      }

      break

  }


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

}
