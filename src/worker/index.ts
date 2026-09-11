import { ReceiveMessageCommand, DeleteMessageCommand, } from '@aws-sdk/client-sqs'
import { sqs } from '../queue/sqs-client.js'
import { processDeploymentJob } from './process-deployment-job.js'


const queueUrl = process.env.SQS_QUEUE_URL


if (!queueUrl) {
  throw new Error("Missing SQS_QUEUE_URL")
}


async function runWorker() {
  while (true) {
    const response = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl,


      MaxNumberOfMessages: 1,

      WaitTimeSeconds: 20,
    })
    )


    const messages = response.Messages ?? []

    for (const message of messages) {
      if (!message.Body || !message.ReceiptHandle) {
        continue
      }

      try {
        const job = JSON.parse(message.Body)

        console.log("recieved job:", job)

        await processDeploymentJob(job)

        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          })
        )
      } catch (error) {
        console.error("job failed", error)

      }
    }

  }
}

runWorker().catch(console.error)
