import { Router } from "express";
import { githubPullRequestEventSchema } from "../../schemas/github-webhook.js";
import { parseGitHubWebhook } from "../../github/parse-github-webhook.js";
import { processGitHubEvent } from "../../github/process-github-event.js";

const router = Router()


router.post("/webhooks/github", async (req, res) => {
  try {
    const rawEvent = parseGitHubWebhook(req)
    const event = githubPullRequestEventSchema.parse(rawEvent)

    await processGitHubEvent(event)

    res.sendStatus(200)
  } catch {
    res.sendStatus(400)

  }
})

export default router
