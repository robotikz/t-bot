import type { AiAnalysisContext, SignalizerAiAnalyzer } from '../ai-analysis.types.js';
import { buildAiSystemPrompt, buildAiUserPrompt } from '../ai-analysis.prompt.js';

interface OpenAiCompatibleAnalyzerOptions {
  apiKey: string | undefined;
  endpoint: string | undefined;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

interface OpenAiMessage {
  role: 'system' | 'user';
  content: string;
}

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OpenAiCompatibleSignalizerAiAnalyzer implements SignalizerAiAnalyzer {
  private readonly endpoint: string;

  constructor(private readonly options: OpenAiCompatibleAnalyzerOptions) {
    this.endpoint = options.endpoint ?? 'https://api.openai.com/v1/chat/completions';
  }

  async analyze(context: AiAnalysisContext): Promise<unknown> {
    if (!this.options.apiKey || !this.options.model) {
      throw new Error('AI_PROVIDER_NOT_CONFIGURED');
    }

    const messages: OpenAiMessage[] = [
      {
        role: 'system',
        content: buildAiSystemPrompt()
      },
      {
        role: 'user',
        content: buildAiUserPrompt(context)
      }
    ];

    const retries = Math.max(0, this.options.maxRetries);

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.options.apiKey}`
          },
          body: JSON.stringify({
            model: this.options.model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
        }

        const json = (await response.json()) as OpenAiResponse;
        const content = json.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
        }

        return content;
      } catch (error) {
        if (attempt >= retries) {
          throw error;
        }

        await sleep(150 * (attempt + 1));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error('AI_PROVIDER_UNREACHABLE');
  }
}
