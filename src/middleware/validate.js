/**
 * Express middleware factory for Joi request validation.
 *
 * BUG: This middleware only validates req.body. Query parameters and URL
 * params are never checked, which means endpoints like GET /transactions/:id
 * accept any string (including SQL injection payloads) without validation.
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const messages = error.details.map((d) => d.message);
      return res.status(400).json({ error: "Validation failed", details: messages });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate };
