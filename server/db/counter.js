const connect = require('./connection');

async function getNextSequence(name) {
  const db = await connect();
  const result = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result.seq;
}

module.exports = { getNextSequence };