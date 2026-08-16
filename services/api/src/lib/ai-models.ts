import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { LanguageModel } from "ai"
import { serverEnv } from "../env"

export const DEFAULT_AI_MODEL = "openrouter/free"

export const AI_MODELS = [
  {
    id: DEFAULT_AI_MODEL,
    provider: "OpenRouter",
    label: "Free models router",
    tier: "free",
    pricing: "Free · rate limited",
  },
  {
    id: "openai/gpt-5-nano",
    provider: "OpenAI via OpenRouter",
    label: "GPT-5 Nano",
    tier: "budget",
    pricing: "$0.05 / $0.40 per 1M tokens",
  },
  {
    id: "qwen/qwen3.5-flash-02-23",
    provider: "Qwen via OpenRouter",
    label: "Qwen3.5 Flash",
    tier: "budget",
    pricing: "$0.065 / $0.26 per 1M tokens",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    provider: "Google via OpenRouter",
    label: "Gemini 2.5 Flash Lite",
    tier: "budget",
    pricing: "$0.10 / $0.40 per 1M tokens",
  },
  {
    id: "deepseek/deepseek-chat-v3.1",
    provider: "DeepSeek via OpenRouter",
    label: "DeepSeek V3.1",
    tier: "budget",
    pricing: "$0.25 / $0.95 per 1M tokens",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    provider: "Anthropic via OpenRouter",
    label: "Claude Haiku 4.5",
    tier: "premium",
    pricing: "$1 / $5 per 1M tokens",
  },
] as const

export type AiModelId = (typeof AI_MODELS)[number]["id"]

export function isKnownAiModel(value: string): value is AiModelId {
  return AI_MODELS.some((model) => model.id === value)
}

export function listAiModels() {
  return AI_MODELS.map((model) => ({
    ...model,
    available: Boolean(serverEnv.OPENROUTER_API_KEY),
  }))
}

export function resolveAiModel(id: string):
  | { ok: true; model: LanguageModel }
  | { ok: false; error: string } {
  const config = AI_MODELS.find((model) => model.id === id)
  if (!config) return { ok: false, error: "Unknown AI model" }
  if (!serverEnv.OPENROUTER_API_KEY) {
    return { ok: false, error: "OPENROUTER_API_KEY is not configured" }
  }

  const openrouter = createOpenRouter({
    apiKey: serverEnv.OPENROUTER_API_KEY,
    appName: "Zany iHub",
    appUrl: serverEnv.WEB_ORIGIN,
    compatibility: "strict",
  })
  return { ok: true, model: openrouter.chat(config.id) }
}
