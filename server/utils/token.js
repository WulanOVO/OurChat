const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET;
const defaultExpiresIn = process.env.JWT_EXPIRES_IN;

// 测试用途万能token，记得删除
const superTokenPrefix = 'super_token_';

function generateToken(payload, expiresIn = defaultExpiresIn) {
  return jwt.sign(payload, secret, { expiresIn });
}

function verifyToken(token) {
  try {
    if (token.startsWith(superTokenPrefix)) {
      return { uid: token.slice(superTokenPrefix.length) };
    }
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
}

module.exports = {
  generateToken,
  verifyToken
};