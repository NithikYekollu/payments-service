const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");
const { clearAuditLog, deriveActionType } = require("../src/middleware/audit");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const testToken = jwt.sign({ sub: "user_123", email: "test@example.com" }, JWT_SECRET);

beforeEach(() => {
  clearAuditLog();
});

describe("Audit middleware", () => {
  it("should record an audit entry with all required fields when a payment is created", async () => {
    await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        customer_id: "cust_001",
        amount: 250.00,
        currency: "USD",
        payment_method: "card",
      });

    const auditRes = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${testToken}`);

    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body.total).toBeGreaterThanOrEqual(1);

    const entry = auditRes.body.entries[0];
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("actor");
    expect(entry).toHaveProperty("ip_address");
    expect(entry).toHaveProperty("action_type");
    expect(entry).toHaveProperty("transaction_id");
    expect(entry).toHaveProperty("amount");

    // Verify ISO 8601 timestamp
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    expect(entry.action_type).toBe("payment.created");
    expect(entry.amount).toBe(250.00);
    expect(entry.actor).toBe("user_123");
    expect(entry.ip_address).toBeTruthy();
    expect(entry.transaction_id).toBeTruthy();
  });

  it("should record an audit entry for refund initiation", async () => {
    await request(app)
      .post("/api/v1/refunds")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        payment_id: "pay_123",
        amount: 50.00,
        reason: "duplicate",
      });

    const auditRes = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${testToken}`);

    const entry = auditRes.body.entries[0];
    expect(entry.action_type).toBe("refund.initiated");
    expect(entry.amount).toBe(50.00);
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("actor");
    expect(entry).toHaveProperty("ip_address");
  });

  it("should record an audit entry for transfer creation", async () => {
    await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        from_account: "acc_123",
        to_account: "acc_456",
        amount: 100.50,
        currency: "USD",
      });

    const auditRes = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${testToken}`);

    const entry = auditRes.body.entries[0];
    expect(entry.action_type).toBe("transfer.created");
    expect(entry.amount).toBe(100.50);
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("actor");
    expect(entry).toHaveProperty("ip_address");
    expect(entry).toHaveProperty("transaction_id");
  });

  it("should filter audit entries by transaction_id", async () => {
    const paymentRes = await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        customer_id: "cust_002",
        amount: 300.00,
        currency: "EUR",
        payment_method: "card",
      });

    const txnId = paymentRes.body.id;

    // Create a second payment to ensure filtering works
    await request(app)
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        customer_id: "cust_003",
        amount: 500.00,
        currency: "GBP",
        payment_method: "card",
      });

    const auditRes = await request(app)
      .get(`/api/v1/audit?transaction_id=${txnId}`)
      .set("Authorization", `Bearer ${testToken}`);

    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body.total).toBe(1);
    expect(auditRes.body.entries[0].transaction_id).toBe(txnId);
  });

  it("should return empty entries when filtering by non-existent transaction_id", async () => {
    const auditRes = await request(app)
      .get("/api/v1/audit?transaction_id=non_existent")
      .set("Authorization", `Bearer ${testToken}`);

    expect(auditRes.statusCode).toBe(200);
    expect(auditRes.body.total).toBe(0);
    expect(auditRes.body.entries).toEqual([]);
  });

  it("should require authentication on the audit endpoint", async () => {
    const res = await request(app).get("/api/v1/audit");
    expect(res.statusCode).toBe(401);
  });

  it("should record audit entry for ledger balance retrieval", async () => {
    await request(app)
      .get("/api/v1/ledger/balance/acc_123")
      .set("Authorization", `Bearer ${testToken}`);

    const auditRes = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${testToken}`);

    const entry = auditRes.body.entries[0];
    expect(entry.action_type).toBe("ledger.balance_retrieved");
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("actor");
    expect(entry).toHaveProperty("ip_address");
  });
});

describe("deriveActionType", () => {
  it("should derive payment.created for POST /api/v1/payments", () => {
    expect(deriveActionType("POST", "/api/v1/payments")).toBe("payment.created");
  });

  it("should derive refund.initiated for POST /api/v1/refunds", () => {
    expect(deriveActionType("POST", "/api/v1/refunds")).toBe("refund.initiated");
  });

  it("should derive transfer.created for POST /api/v1/transfers", () => {
    expect(deriveActionType("POST", "/api/v1/transfers")).toBe("transfer.created");
  });

  it("should derive transfer.retrieved for GET /api/v1/transfers/:id", () => {
    expect(deriveActionType("GET", "/api/v1/transfers/abc123")).toBe("transfer.retrieved");
  });

  it("should derive ledger.reconciled for POST /api/v1/ledger/reconcile", () => {
    expect(deriveActionType("POST", "/api/v1/ledger/reconcile")).toBe("ledger.reconciled");
  });

  it("should derive ledger.balance_retrieved for GET /api/v1/ledger/balance/:id", () => {
    expect(deriveActionType("GET", "/api/v1/ledger/balance/acc_123")).toBe("ledger.balance_retrieved");
  });

  it("should strip query strings before deriving action type", () => {
    expect(deriveActionType("GET", "/api/v1/payments?page=1")).toBe("payment.retrieved");
    expect(deriveActionType("GET", "/api/v1/transfers?status=completed&page=2")).toBe("transfer.retrieved");
  });
});
