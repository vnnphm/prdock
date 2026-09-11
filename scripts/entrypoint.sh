#!/bin/sh
set -eu

: "${AWS_REGION:?AWS_REGION is required}"
: "${ECR_REGISTRY:?ECR_REGISTRY is required}"
: "${ECR_REPOSITORY:?ECR_REPOSITORY is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

IMAGE_URI="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

echo "Logging into ECR..."

aws ecr get-login-password \
  --region "$AWS_REGION" \
  | docker login \
      --username AWS \
      --password-stdin "$ECR_REGISTRY"

echo "Building image: $IMAGE_URI"

docker build \
  -t "$IMAGE_URI" \
  .

echo "Pushing image..."

docker push "$IMAGE_URI"

echo "Built and pushed: $IMAGE_URI"
