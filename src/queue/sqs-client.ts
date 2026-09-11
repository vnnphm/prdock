import { SQSClient } from "@aws-sdk/client-sqs";


const region = process.env.AWS_REGION


if (!region) {
  throw new Error("Region required")
}

export const sqs = new SQSClient({
  region: region
})
