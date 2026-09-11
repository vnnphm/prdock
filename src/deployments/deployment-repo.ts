import { prisma } from "../db/prisma.js";
import type { Deployment } from "../generated/prisma/client.js";

export function findDeploymentByPullRequest(repoFullName: string, prNumber: number) {
  return prisma.deployment.findUnique({
    where: { repoFullName_prNumber: { repoFullName, prNumber } },
  });
}

export function createQueuedDeployment({
  repoFullName,
  prNumber,
  commitSha,
}: Pick<Deployment, "repoFullName" | "prNumber" | "commitSha">) {
  return prisma.deployment.create({
    data: { repoFullName, prNumber, commitSha, status: "QUEUED" },
  });
}

export function updateDeployment(
  id: string,
  data: Partial<Pick<Deployment, "commitSha" | "status" | "errorMessage">>,
) {
  return prisma.deployment.update({ where: { id }, data });
}
