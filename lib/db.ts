import mongoose from "mongoose"
import { setServers } from "node:dns/promises"

setServers(["1.1.1.1", "8.8.8.8"])

const { DB_URI, DB_NAME, DB_APP } = process.env

export const connectDB = async () => {
  if (!DB_URI || !DB_NAME || !DB_APP)
    throw new Error("Please define the database environment variables!")

  try {
    await mongoose.connect(DB_URI, {
      appName: DB_NAME,
      dbName: DB_APP,
    })
  } catch (error) {
    console.error("Error connecting to database: ", error)
    process.exit(1)
  }
}
