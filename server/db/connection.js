const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);
const db = client.db();

module.exports = { client, db, ObjectId };