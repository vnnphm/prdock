export type DeploymentJob = | {
  version: 1
  action: "DEPLOY"
  deploymentId: string
  commitSha: string
}
  | {
  version: 1
  action: "DESTROY"
  deploymentId: string
}
