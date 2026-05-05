/**
 * AI Service for script parsing using Claude API
 * Uses the serverless /api/ai endpoint for secure API key handling
 */

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Call the AI API with retry logic and exponential backoff
 */
export async function callAI(
  prompt: string,
  options: {
    system?: string;
    maxTokens?: number;
    maxRetries?: number;
  } = {}
): Promise<string> {
  const { system, maxTokens = 4000, maxRetries = 3 } = options;


  const messages: AIMessage[] = [{ role: 'user', content: prompt }];

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {

      // Use relative URL for Vercel deployment, falls back to local for dev
      const apiUrl = '/api/ai';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          system,
          maxTokens,
          model: 'claude-sonnet-4-20250514',
        }),
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.error || '';


        // Handle rate limiting
        if (response.status === 429) {
          // Usage/spend limits are non-retryable — the user is capped until the reset date
          if (errorMessage.includes('usage limit') || errorMessage.includes('will regain access')) {
            throw new Error(errorMessage || 'You have reached your API usage limits. Please check your Anthropic console for the reset date.');
          }
          // Transient rate limits (requests-per-minute) are retryable
          const waitTime = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Handle server overloaded (529)
        if (response.status === 529) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Handle credit/billing errors (non-retryable)
        if (response.status === 400 && (errorMessage.includes('credit balance') || errorMessage.includes('purchase credits'))) {
          throw new Error('Insufficient API credits. Please add credits at console.anthropic.com');
        }

        // Handle auth errors (non-retryable)
        if (response.status === 401 || response.status === 403) {
          throw new Error('Invalid API key. Please check your configuration.');
        }

        // Handle 500-level server errors with retry
        if (response.status >= 500) {
          const waitTime = Math.pow(2, attempt + 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        throw new Error(errorMessage || `API error: ${response.status}`);
      }

      const data: AIResponse = await response.json();

      if (data.content && data.content.length > 0) {
        return data.content[0].text;
      }

      throw new Error('Empty response from AI');
    } catch (error) {
      lastError = error as Error;
      console.error(`AI call attempt ${attempt + 1} failed:`, error);

      // Don't retry for certain errors
      const errorMsg = lastError.message || '';
      if (errorMsg.includes('Insufficient API credits') ||
          errorMsg.includes('Invalid API key') ||
          errorMsg.includes('usage limit') ||
          errorMsg.includes('will regain access')) {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('AI call failed after retries');
}


/**
 * Generate a synopsis for a scene using AI
 */
export async function generateSceneSynopsis(
  sceneHeading: string,
  sceneContent: string
): Promise<string> {
  const prompt = `Generate a brief 15-25 word synopsis for this screenplay scene:

Scene: ${sceneHeading}

Content:
${sceneContent.slice(0, 2000)}

Return ONLY the synopsis text, no quotes or explanation.`;

  try {
    const synopsis = await callAI(prompt, { maxTokens: 100 });
    return synopsis.trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Failed to generate synopsis:', error);
    return '';
  }
}

/**
 * Check if AI service is available
 */
export async function checkAIAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
