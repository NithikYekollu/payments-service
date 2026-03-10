const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const config = require("../config/default.json");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function generateToken(payload = { sub: "user_rate_limit_test" }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("Rate limiting on authenticated routes", () => {
  it("should return 429 after exceeding the rate limit on /api/v1/payments", async () => {
    const max = config.rateLimit.max;
    const token = generateToken();

    // Send requests up to the limit
    for (let i = 0; i < max; i++) {
      await request(app)
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${token}`)
        .send({
          customer_id: "cust_123",
          amount: 50,
          currency: "USD",
          payment_method: "pm_card",
        });
    }

    // The next request should be rate limited
    const res = await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customer_id: "cust_123",
        amount: 50,
        currency: "USD",
        payment_method: "pm_card",
      });

    expect(res.statusCode).toBe(429);
    expect(res.body).toHaveProperty("error");
    expect(res.headers).toHaveProperty("retry-after");
  });

  it("should include rate limit headers in responses", async () => {
    const token = generateToken({ sub: "user_headers_test" });

    const res = await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customer_id: "cust_123",
        amount: 50,
        currency: "USD",
        payment_method: "pm_card",
      });

    expect(res.headers).toHaveProperty("ratelimit-limit");
    expect(res.headers).toHaveProperty("ratelimit-remaining");
    expect(res.headers).toHaveProperty("ratelimit-reset");
  });
});
