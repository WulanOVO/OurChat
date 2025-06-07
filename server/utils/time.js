function toTimestamp(date) {
  return Math.floor(date.getTime() / 1000);
}

module.exports = { toTimestamp };
