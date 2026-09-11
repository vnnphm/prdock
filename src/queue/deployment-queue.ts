import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqs } from "./sqs-client.js";
import type { DeploymentJob } from "./deployment-job.js";

//send job
export async function sendDeploymentJob(job: DeploymentJob) {
  const queueUrl = process.env.SQS_QUEUE_URL

  if (!queueUrl) {
    throw new Error("SQS_QUEUE_URL is missing")
  }

  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(job)

  })
}
