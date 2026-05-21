const { MongoClient } = require("mongodb");

let client;
let database;

async function getDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    database = client.db("hotel-booking");
  }

  return database;
}

module.exports = { getDb };
