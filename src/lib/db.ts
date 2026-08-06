import mongoose from "mongoose";
import { getEnvVars } from "./env";

const globalForMongoose = globalThis as unknown as {
  mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

const RETRY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDB(): Promise<typeof mongoose | null> {
  const vars = getEnvVars();
  if (!vars.mongodbUri) return null;

  if (globalForMongoose.mongoose?.conn && mongoose.connection.readyState === 1) {
    return globalForMongoose.mongoose.conn;
  }

  // Stale cache (e.g. connection dropped while server kept running) — reset so
  // the retry loop below can establish a fresh connection.
  globalForMongoose.mongoose = { conn: null, promise: null };

  // TLS handshakes to Atlas can intermittently fail on some networks; retry a few
  // times before giving up so a flaky handshake doesn't fail the whole request.
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const promise = mongoose.connect(vars.mongodbUri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 10000,
      });

      if (!globalForMongoose.mongoose) {
        globalForMongoose.mongoose = { conn: null, promise: null };
      }
      globalForMongoose.mongoose.promise = promise;
      globalForMongoose.mongoose.conn = await promise;
      return globalForMongoose.mongoose.conn;
    } catch (error) {
      lastError = error;
      await mongoose.disconnect().catch(() => {});
      globalForMongoose.mongoose = { conn: null, promise: null };
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  throw lastError;
}

export function isMongooseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}