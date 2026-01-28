import { LLMProvider } from '../../infrastructure/llm/LLMProvider';

const SUMMARIZATION_SYSTEM_PROMPT = `
You are a helpful AI memory assistant. Your goal is to summarize the provided "Memory Fragments" in the context of the user's "Query".

INSTRUCTIONS:
1. Synthesize the relevant information from the memory fragments.
2. Explain how they are related to the query.
3. Be concise and professional.
4. If the memories contain conflicting information, highlight it.
5. If the memories are not relevant to the query, state that clearly.
6. Format your output in Markdown.
`.trim();

/**
 * Service for generating natural language summaries of retrieved context.
 */
export class Summarizer {
    private llm: LLMProvider;

    constructor() {
        this.llm = LLMProvider.getInstance();
    }

    /**
     * Summarizes retrieved context based on a query.
     */
    public async summarize(query: string, fragments: any[]): Promise<string> {
        if (!fragments || fragments.length === 0) {
            return "No relevant memories found to summarize.";
        }

        // Prepare context string
        const contextStr = fragments.map((f, i) => {
            const content = f.memory?.content || f.content;
            const nodes = f.context?.nodes?.map((n: any) => n.name).join(', ') || 'none';
            return `Fragment ${i + 1}: "${content}" (Related Entities: ${nodes})`;
        }).join('\n\n');

        const userPrompt = `
USER QUERY: "${query}"

MEMORY FRAGMENTS:
${contextStr}

SUMMARY:
`.trim();

        try {
            return await this.llm.generateChatCompletion(
                SUMMARIZATION_SYSTEM_PROMPT,
                userPrompt,
                { temperature: 0.5 }
            );
        } catch (error) {
            console.error('Summarization failed:', error);
            return "Failed to generate context summary.";
        }
    }
}
