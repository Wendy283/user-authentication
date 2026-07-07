const mongodb = require('mongodb');

const MongoClient = mongodb.MongoClient;

let database;

// Inside data/database.js (or wherever your connection logic lives)
async function connectToDatabase() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  database = client.db('auth-demo');
  console.log('MongoDB successfully initialized database!');
}

function getDb() {
  if (!database) {
    throw { message: 'You must connect first!' };
  }
  return database;
}

module.exports = {
  connectToDatabase: connectToDatabase,
  getDb: getDb,
};
