import Ably from "ably"

const CLIENT_ID = process.env.NEXT_PUBLIC_ABLY_CLIENT_ID
const API_KEY = process.env.NEXT_PUBLIC_ABLY_SUBSCRIBE_KEY

if (!CLIENT_ID || !API_KEY) {
  throw new Error(
    "Ably credentials are not set. Please check your environment variables."
  )
}

export const ablyClient = new Ably.Realtime({
  key: API_KEY,
  clientId: CLIENT_ID,
})
