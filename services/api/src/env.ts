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
    S3_ENDPOINT: environment.S3_ENDPOINT?.trim() || "http://localhost:9000",
    S3_ACCESS_KEY_ID: environment.S3_ACCESS_KEY_ID?.trim() || "minioadmin",
    S3_SECRET_ACCESS_KEY:
      environment.S3_SECRET_ACCESS_KEY?.trim() || "minioadmin",
    S3_BUCKET: environment.S3_BUCKET?.trim() || "zany-ihub",
    S3_REGION: environment.S3_REGION?.trim() || "us-east-1",
    OPENROUTER_API_KEY: environment.OPENROUTER_API_KEY?.trim() || undefined,
  }
}

export const serverEnv = readServerEnv(process.env)
