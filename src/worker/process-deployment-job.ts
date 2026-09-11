import { prisma } from "../db/prisma.js";
import type { DeploymentJob } from "../queue/deployment-job.js";


export async function processDeploymentJob(job: DeploymentJob) {
  const deployment = await prisma.deployment.findUnique({
    where: {
      id: job.deploymentId,
    }
  })

  if (!deployment) {
    return
  }

  switch (job.action) {
    case "DEPLOY": {
      // Standard SQS can deliver messages out of order.
      // Make sure this job is still for the latest commit.

      if (deployment.commitSha !== job.commitSha) {
        return;
      }

      console.log(
        `Deploying ${deployment.repoFullName} PR #${deployment.prNumber} at ${job.commitSha}`
      );

      // TEMPORARY
      // Later:
      // 1. set BUILDING
      // 2. docker build
      // 3. push ECR
      // 4. deploy ECS
      // 5. set READY

      return;
    }

    case "DESTROY": {
      console.log(
        `Destroying preview for ${deployment.repoFullName} PR #${deployment.prNumber}`
      );

      // TEMPORARY
      // Later:
      // 1. destroy ECS service
      // 2. set DELETED

      return;
    }
  }
}
