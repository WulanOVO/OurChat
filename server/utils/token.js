const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
const defaultExpiresIn = process.env.JWT_EXPIRES_IN;

function generateToken(payload, expiresIn = defaultExpiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};