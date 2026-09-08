import type { Request } from "express"


export function parseGitHubWebhook(req: Request) {
  const githubDeliveryId = req.header("x-github-delivery")
  const eventName = req.header("x-github-event")

  if (!githubDeliveryId || !eventName) {
      throw new Error("Missing required GitHub webhook headers");
  }


  //ok to refer to properties as any since zod validation covers during webhook POST


  return {
    githubDeliveryId,
    eventName,
    action: req.body.action,
    repoFullName: req.body.repository?.full_name,
    prNumber: req.body.pull_request?.number,
    commitSha: req.body.pull_request?.head?.sha,
  }
}
