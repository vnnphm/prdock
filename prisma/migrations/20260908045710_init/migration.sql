-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'BUILDING', 'PUSHING_IMAGE', 'DEPLOYING', 'READY', 'FAILED', 'DELETING', 'DELETED');

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL,
    "previewUrl" TEXT,
    "imageUri" TEXT,
    "serviceArn" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubWebhookEvent" (
    "id" TEXT NOT NULL,
    "githubDeliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "commitSha" TEXT,
    "deploymentId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deployment_repoFullName_prNumber_key" ON "Deployment"("repoFullName", "prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubWebhookEvent_githubDeliveryId_key" ON "GitHubWebhookEvent"("githubDeliveryId");

-- AddForeignKey
ALTER TABLE "GitHubWebhookEvent" ADD CONSTRAINT "GitHubWebhookEvent_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
