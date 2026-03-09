const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");

const TEST_TOKEN = jwt.sign({ sub: "test-user", role: "admin" }, process.env.JWT_SECRET || "dev-secret");

describe("POST /api/v1/transfers", () => {
  it("should create a transfer with valid input", async () => {
    const res = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({
        from_account: "acc_123",
        to_account: "acc_456",
        amount: 100.50,
        currency: "USD",
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.status).toBe("pending");
  });

  it("should reject transfer with missing amount", async () => {
    const res = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ from_account: "acc_123", to_account: "acc_456" });
    expect(res.statusCode).toBe(400);
  });

  it("should reject transfer with negative amount", async () => {
    const res = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send({ from_account: "acc_123", to_account: "acc_456", amount: -50 });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/transfers/:id", () => {
  it("should return 200 for a valid UUID", async () => {
    const res = await request(app)
      .get("/api/v1/transfers/550e8400-e29b-41d4-a716-446655440000")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id");
  });

  it("should return 400 for a non-UUID string", async () => {
    const res = await request(app)
      .get("/api/v1/transfers/not-a-uuid")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });

  it("should return 400 for a SQL injection payload", async () => {
    const res = await request(app)
      .get("/api/v1/transfers/1; DROP TABLE transfers;--")
      .set("Authorization", `Bearer ${TEST_TOKEN}`);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
  });
});
