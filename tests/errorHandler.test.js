const { errorHandler } = require("../src/middleware/errorHandler");

describe("errorHandler middleware", () => {
  let err, req, res, next;

  beforeEach(() => {
    err = new Error("Something broke");
    err.statusCode = 500;
    req = { path: "/api/v1/test", method: "GET" };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it("should include stack trace and error message in development", () => {
    process.env.NODE_ENV = "development";
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Something broke");
    expect(body.stack).toBeDefined();
  });

  it("should hide stack trace and error message in production", () => {
    process.env.NODE_ENV = "production";
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Internal server error");
    expect(body.stack).toBeUndefined();
  });

  it("should hide stack trace and error message in staging", () => {
    process.env.NODE_ENV = "staging";
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Internal server error");
    expect(body.stack).toBeUndefined();
  });

  it("should hide stack trace when NODE_ENV is not set", () => {
    delete process.env.NODE_ENV;
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("Internal server error");
    expect(body.stack).toBeUndefined();
  });

  it("should use err.statusCode when provided", () => {
    err.statusCode = 403;
    process.env.NODE_ENV = "production";
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should default to 500 when statusCode is not set", () => {
    delete err.statusCode;
    process.env.NODE_ENV = "production";
    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
