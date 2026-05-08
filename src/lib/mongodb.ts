import { MongoClient, type Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Module-level singleton for production (one per cold start).
let _prodClientPromise: Promise<MongoClient> | null = null;

// Lazily create the MongoClient so a missing MONGODB_URI throws at call time
// (inside a try/catch) rather than at module-evaluation time (uncatchable).
function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(
      new Error(
        "MONGODB_URI is not configured. Add it to .env.local and restart the dev server.",
      ),
    );
  }

  if (process.env.NODE_ENV === "development") {
    // Reuse across HMR reloads via global.
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    return global._mongoClientPromise;
  }

  if (!_prodClientPromise) {
    _prodClientPromise = new MongoClient(uri).connect();
  }
  return _prodClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db("readable");
}
