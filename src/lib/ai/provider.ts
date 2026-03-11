import type { LanguageModel } from 'ai'

/**
 * AI Provider configuration.
 *
 * Set AI_PROVIDER in .env.local to choose:
 *   - "google"     → Google AI (Gemini) — requires GOOGLE_GENERATIVE_AI_API_KEY
 *   - "openai"     → OpenAI — requires OPENAI_API_KEY
 *   - "openrouter" → OpenRouter — requires OPENROUTER_API_KEY
 *
 * Default: "google" (fastest + cheapest for structured output)
 */

export type AIProvider = 'google' | 'openai' | 'openrouter'

export function getProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || 'google') as AIProvider
  if (!['google', 'openai', 'openrouter'].includes(provider)) {
    return 'google'
  }
  return provider
}

export async function getModel(): Promise<LanguageModel> {
  const provider = getProvider()

  switch (provider) {
    case 'google': {
      const { google } = await import('@ai-sdk/google')
      return google('gemini-2.5-flash')
    }
    case 'openai': {
      const { openai } = await import('@ai-sdk/openai')
      return openai('gpt-4o-mini')
    }
    case 'openrouter': {
      const { createOpenRouter } = await import('@openrouter/ai-sdk-provider')
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY || '' })
      return openrouter('google/gemini-2.0-flash-001')
    }
  }
}

/** Check if the configured provider has its API key set */
export function hasApiKey(): boolean {
  const provider = getProvider()
  switch (provider) {
    case 'google': return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    case 'openai': return !!process.env.OPENAI_API_KEY
    case 'openrouter': return !!process.env.OPENROUTER_API_KEY
  }
}
