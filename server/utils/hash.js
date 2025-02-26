const crypto = require('crypto');

function createHash(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

module.exports = {
  createHash
};