import request from 'supertest'
import { describe, expect, it, vi } from "vitest"


import { app } from "../src/api/app.js"

vi.mock("../src/queue/deployment-queue.js", () => ({
  sendDeploymentJob: vi.fn().mockResolvedValue(undefined),
}))

describe("GET /health", () => {
  it("returns 200", async () => {
    const response = await request(app)
      .get("/health")


    expect(response.status).toBe(200)

    expect(response.body).toEqual({
      status: "ok"
    })
  })
})
