import { ENV } from '../../config/env';
import { Logger } from '../../core/logging/Logger';

/**
 * Lightweight Provider for LLM Chat Completions.
 * Supports OpenAI-compatible APIs (OpenAI, LM Studio, Ollama).
 */
export class LLMProvider {
    private static instance: LLMProvider;
    private baseUrl: string;
    private apiKey: string;
    private model: string;

    private constructor() {
        this.baseUrl = ENV.OPENAI_BASE_URL || 'https://api.openai.com/v1';
        this.apiKey = ENV.OPENAI_API_KEY || '';
        this.model = ENV.LLM_MODEL;
    }

    public static getInstance(): LLMProvider {
        if (!LLMProvider.instance) {
            LLMProvider.instance = new LLMProvider();
        }
        return LLMProvider.instance;
    }

    /**
     * Generates a chat completion.
     * @param systemPrompt - Instructions for the AI
     * @param userPrompt - User input
     * @param options - Optional parameters like temperature and jsonMode
     */
    public async generateChatCompletion(
        systemPrompt: string,
        userPrompt: string,
        options: { jsonMode?: boolean; temperature?: number } = {}
    ): Promise<string> {
        const { jsonMode = false, temperature = 0.3 } = options;

        try {
            // Mock response for test environment if no real API key is provided
            const isMockMode = ENV.NODE_ENV === 'test' && (!this.apiKey || this.apiKey === 'lm-studio');
            if (isMockMode) {
                if (jsonMode) {
                    return JSON.stringify({
                        entities: [
                            { name: "Alice", type: "person" },
                            { name: "TypeScript", type: "entity" }
                        ],
                        relationships: [
                            { from: "Alice", to: "TypeScript", type: "uses" }
                        ]
                    });
                }

                if (systemPrompt.toLowerCase().includes('summarize')) {
                    return "This is a mock summary of the retrieved memories related to your query.";
                }

                return "Mock LLM Response";
            }

            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: jsonMode ? { type: 'json_object' } : undefined,
                    temperature: temperature
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`LLM API failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error('LLM returned an empty response');
            }

            return content;
        } catch (error) {
            Logger.error('LLMProvider', 'LLM completion failed:', error);
            throw error;
        }
    }
}
