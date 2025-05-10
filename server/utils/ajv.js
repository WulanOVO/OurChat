const Ajv = require('ajv');
const ajv = new Ajv();

function validate(data, schema) {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  return valid;
}

module.exports = { validate };
