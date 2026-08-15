const requiredEnvNames = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "WEB_ORIGIN",
] as const

type Environment = Record<string, string | undefined>

export function readServerEnv(environment: Environment) {
  for (const name of requiredEnvNames) {
    if (!environment[name]?.trim()) {
      throw new Error(`Missing required environment variable: ${name}`)
    }
  }

  return {
    DATABASE_URL: environment.DATABASE_URL as string,
    BETTER_AUTH_SECRET: environment.BETTER_AUTH_SECRET as string,
    BETTER_AUTH_URL: environment.BETTER_AUTH_URL as string,
    WEB_ORIGIN: environment.WEB_ORIGIN as string,
  }
}

export const serverEnv = readServerEnv(process.env)
