const jwt = require('jsonwebtoken');

const secret = 'secret';

function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken,
};