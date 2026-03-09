const request = require("supertest");
const app = require("../src/index");

describe("POST /api/v1/transfers", () => {
  it("should create a transfer with valid input", async () => {
    const res = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", "Bearer test-token")
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
      .set("Authorization", "Bearer test-token")
      .send({ from_account: "acc_123", to_account: "acc_456" });
    expect(res.statusCode).toBe(400);
  });

  it("should reject transfer with negative amount", async () => {
    const res = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", "Bearer test-token")
      .send({ from_account: "acc_123", to_account: "acc_456", amount: -50 });
    expect(res.statusCode).toBe(400);
  });
});
