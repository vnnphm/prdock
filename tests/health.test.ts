import request from 'supertest'
import { describe, expect, it } from "vitest"


import { app } from "../src/api/app.js"


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
