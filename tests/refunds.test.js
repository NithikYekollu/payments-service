const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const { clearAll } = require("../src/utils/store");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const token = jwt.sign({ sub: "user_test", role: "admin" }, JWT_SECRET);

function authHeader() {
  return ["Authorization", `Bearer ${token}`];
}

/** Helper: create a payment and return its id + amount */
async function createPayment(amount = 50) {
  const res = await request(app)
    .post("/api/v1/payments")
    .set(...authHeader())
    .send({
      customer_id: "cust_1",
      amount,
      currency: "USD",
      payment_method: "pm_card",
    });
  expect(res.statusCode).toBe(201);
  return res.body;
}

beforeEach(() => {
  clearAll();
});

describe("POST /api/v1/refunds", () => {
  it("should succeed for a valid full refund", async () => {
    const payment = await createPayment(50);
    const res = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 50, reason: "requested_by_customer" });
    expect(res.statusCode).toBe(201);
    expect(res.body.amount).toBe(50);
    expect(res.body.status).toBe("succeeded");
    expect(res.body.payment_id).toBe(payment.id);
  });

  it("should default to full payment amount when amount is omitted", async () => {
    const payment = await createPayment(75);
    const res = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, reason: "duplicate" });
    expect(res.statusCode).toBe(201);
    expect(res.body.amount).toBe(75);
  });

  it("should reject refund when amount exceeds original payment", async () => {
    const payment = await createPayment(50);
    const res = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 10000, reason: "requested_by_customer" });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/exceeds original payment amount/);
  });

  it("should reject duplicate full refund (already fully refunded)", async () => {
    const payment = await createPayment(50);
    // First refund succeeds
    const first = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 50, reason: "requested_by_customer" });
    expect(first.statusCode).toBe(201);

    // Second refund should be rejected as duplicate
    const second = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 50, reason: "requested_by_customer" });
    expect(second.statusCode).toBe(409);
    expect(second.body.error).toMatch(/already been fully refunded/);
  });

  it("should reject partial refunds that sum beyond original amount", async () => {
    const payment = await createPayment(100);
    // First partial refund: $60
    const first = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 60, reason: "requested_by_customer" });
    expect(first.statusCode).toBe(201);

    // Second partial refund: $50 (total would be $110 > $100)
    const second = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 50, reason: "requested_by_customer" });
    expect(second.statusCode).toBe(400);
    expect(second.body.error).toMatch(/exceeds remaining refundable amount/);
  });

  it("should allow multiple partial refunds within original amount", async () => {
    const payment = await createPayment(100);
    const first = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 40, reason: "requested_by_customer" });
    expect(first.statusCode).toBe(201);

    const second = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 60, reason: "requested_by_customer" });
    expect(second.statusCode).toBe(201);
  });

  it("should handle floating-point decimal amounts correctly (0.1 + 0.2)", async () => {
    const payment = await createPayment(0.3);
    // First partial refund: $0.10
    const first = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 0.1, reason: "requested_by_customer" });
    expect(first.statusCode).toBe(201);

    // Second partial refund: $0.20 (total = $0.30 which equals the payment)
    const second = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: payment.id, amount: 0.2, reason: "requested_by_customer" });
    expect(second.statusCode).toBe(201);
  });

  it("should reject refund for non-existent payment", async () => {
    const res = await request(app)
      .post("/api/v1/refunds")
      .set(...authHeader())
      .send({ payment_id: "pay_nonexistent", amount: 10, reason: "fraudulent" });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/not found/);
  });
});
