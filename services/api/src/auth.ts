import { db, schema } from "@workspace/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN!],
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
})
