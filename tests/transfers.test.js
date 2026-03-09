const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../src/index");

// Mock the redis module before requiring any module that uses it
jest.mock("redis", () => {
  const store = new Map();
  const mockClient = {
    isOpen: true,
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(async (key) => store.get(key) || null),
    set: jest.fn(async (key, value) => { store.set(key, value); }),
    on: jest.fn(),
  };
  // Expose store for clearing between tests
  mockClient._store = store;
  return {
    createClient: jest.fn(() => mockClient),
    _mockClient: mockClient,
  };
});

const redis = require("redis");

const TEST_TOKEN = jwt.sign({ sub: "test-user", role: "admin" }, process.env.JWT_SECRET || "dev-secret");

describe("POST /api/v1/transfers", () => {
  beforeEach(() => {
    // Clear the mock Redis store between tests
    redis._mockClient._store.clear();
  });

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

  it("should return the same transfer when duplicate request has same Idempotency-Key", async () => {
    const payload = {
      from_account: "acc_123",
      to_account: "acc_456",
      amount: 250.00,
      currency: "USD",
    };
    const idempotencyKey = "unique-key-12345";

    const first = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(first.statusCode).toBe(201);
    expect(first.body).toHaveProperty("id");

    const second = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(payload);

    expect(second.statusCode).toBe(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it("should create separate transfers when no Idempotency-Key is provided", async () => {
    const payload = {
      from_account: "acc_123",
      to_account: "acc_456",
      amount: 75.00,
      currency: "USD",
    };

    const first = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send(payload);

    const second = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .send(payload);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it("should create separate transfers for different Idempotency-Keys", async () => {
    const payload = {
      from_account: "acc_123",
      to_account: "acc_456",
      amount: 300.00,
      currency: "USD",
    };

    const first = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Idempotency-Key", "key-aaa")
      .send(payload);

    const second = await request(app)
      .post("/api/v1/transfers")
      .set("Authorization", `Bearer ${TEST_TOKEN}`)
      .set("Idempotency-Key", "key-bbb")
      .send(payload);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });
});
