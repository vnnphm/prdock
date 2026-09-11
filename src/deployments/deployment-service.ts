import type { Deployment } from "../generated/prisma/client.js";
import type { GitHubPullRequestEvent } from "../schemas/github-webhook.js";
import {
  createQueuedDeployment,
  findDeploymentByPullRequest,
  updateDeployment,
} from "./deployment-repo.js";

type PullRequestAction = Pick<
  GitHubPullRequestEvent,
  "action" | "repoFullName" | "prNumber" | "commitSha"
>;

export async function applyPullRequestAction(input: PullRequestAction): Promise<Deployment | null> {
  const deployment = await findDeploymentByPullRequest(input.repoFullName, input.prNumber);

  switch (input.action) {
    case "opened":
      return deployment ?? createQueuedDeployment(input);

    case "synchronize":
      return deployment
        ? updateDeployment(deployment.id, { commitSha: input.commitSha, status: "QUEUED" })
        : null;

    case "reopened":
      return deployment
        ? updateDeployment(deployment.id, {
            commitSha: input.commitSha,
            status: "QUEUED",
            errorMessage: null,
          })
        : createQueuedDeployment(input);

    case "closed":
      return deployment
        ? updateDeployment(deployment.id, { status: "DELETING" })
        : null;
  }
}
