const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'chatroom';

async function connect() {
  try {
    await client.connect();
    return client.db(dbName);
  } catch (err) {
    console.error('MongoDB 连接错误:', err);
    process.exit(1);
  }
}

module.exports = { connect, client };