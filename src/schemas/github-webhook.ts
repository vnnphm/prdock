import z from "zod";


export const githubPullRequestEventSchema = z.object({
  githubDeliveryId: z.string().min(1),


  eventName: z.literal("pull_request"),

  action: z.enum([
    "opened",
    "synchronize",
    "reopened",
    "closed"
  ]),

  repoFullName: z.string().min(1),

  prNumber: z.number().int().positive(),

  commitSha: z.string().min(1)


})

export type GitHubPullRequestEvent =
  z.infer<typeof githubPullRequestEventSchema>;
