const { ObjectId } = require('../db/connection');

function isObjectId(value) {
  return ObjectId.isValid(value);
}

function toObjectId(value) {
  if (value.startsWith('#') && isObjectId(value.slice(1))) {
    return new ObjectId(value.slice(1));
  }
  return value;
}

function fromObjectId(value) {
  if (isObjectId(value)) {
    return `#${value.toString()}`;
  }
  return value;
}

module.exports = {
  isObjectId,
  toObjectId,
  fromObjectId,
};
