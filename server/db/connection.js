const { MongoClient } = require('mongodb');

const uri = 'mongodb://localhost:27017';
const client = new MongoClient(uri);
const dbName = 'chatroom';

async function connect() {
  try {
    await client.connect();
    return client.db(dbName);
  } catch (err) {
    console.error(err);
  }
}

module.exports = connect;