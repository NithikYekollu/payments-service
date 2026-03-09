const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");

const TEST_TOKEN = jwt.sign({ sub: "test-user", role: "admin" }, process.env.JWT_SECRET || "dev-secret");

describe("GET /api/v1/ledger/balance/:accountId", () => {
  it("should return 200 for a valid UUID", async () => {
    const res = await request(app)
      .get("/api/v1/ledger/balance/550e8400-e29b-41d4-a716-446655440000")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("account_id");
  });

  it("should return 400 for a non-UUID string", async () => {
    const res = await request(app)
      .get("/api/v1/ledger/balance/not-a-uuid")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for a SQL injection payload", async () => {
    const res = await request(app)
      .get("/api/v1/ledger/balance/1; DROP TABLE accounts;--")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});
