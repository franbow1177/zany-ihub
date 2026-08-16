import { zeroDrizzle } from "@rocicorp/zero/server/adapters/drizzle"
import { db } from "@workspace/db"
import { schema } from "@workspace/zero/schema"

export const dbProvider = zeroDrizzle(schema, db)

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
