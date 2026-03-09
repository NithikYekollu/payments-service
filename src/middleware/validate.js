/**
 * Express middleware factory for Joi request validation.
 *
 * Accepts either a single Joi schema (applied to req.body for backward
 * compatibility) or a schema map with keys { body, params, query }.
 */
function validate(schema) {
  // Support legacy usage: validate(joiSchema) treats it as body-only
  const schemaMap =
    schema && schema.body === undefined && schema.params === undefined && schema.query === undefined
      ? { body: schema }
      : schema;

  return (req, res, next) => {
    const allErrors = [];

    for (const key of ["params", "query", "body"]) {
      if (!schemaMap[key]) continue;
      const { error, value } = schemaMap[key].validate(req[key], { abortEarly: false });
      if (error) {
        allErrors.push(...error.details.map((d) => d.message));
      } else {
        req[key] = value;
      }
    }

    if (allErrors.length) {
      return res.status(400).json({ error: "Validation failed", details: allErrors });
    }

    next();
  };
}

module.exports = { validate };
