const mongoose = require("mongoose");
async function main() {
  await mongoose.connect(process.env.DBURI, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  const res = await db.collection("users").updateOne({ email: process.env.MGR_EMAIL }, { $set: { role: "manager" } });
  console.log("promoted:", res.modifiedCount);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });