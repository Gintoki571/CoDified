import { z } from 'zod';
import { LLMProvider } from '../../infrastructure/llm/LLMProvider';

// Extraction Schemas
export const EntityExtractionSchema = z.object({
    entities: z.array(z.object({
        name: z.string(),
        type: z.string().default('concept'),
        metadata: z.record(z.string(), z.any()).default({})
    })),
    relationships: z.array(z.object({
        from: z.string(),
        to: z.string(),
        type: z.string()
    }))
});

export type ExtractedData = z.infer<typeof EntityExtractionSchema>;

const EXTRACTION_SYSTEM_PROMPT = `
You are an expert knowledge graph extractor. Your task is to extract entities and their relationships from the provided text.

OUTPUT FORMAT:
Return ONLY a JSON object with the following structure:
{
  "entities": [
    { "name": "Entity Name", "type": "concept|entity|event|person|place", "metadata": { "key": "value" } }
  ],
  "relationships": [
    { "from": "Name of Source Entity", "to": "Name of Target Entity", "type": "related_to|part_of|mentions|owned_by" }
  ]
}

RULES:
1. "name" should be the most common identifier (e.g. "iPhone" not "The new iPhone 15").
2. "type" should be lowercase and concise.
3. If no entities or relationships are found, return empty arrays.
4. Do not include the main user input itself as an entity, only the subjects and objects mentioned within it.
5. Be conservative; only extract meaningful entities.
`.trim();

/**
 * Service for extracting structured graph data from text.
 */
export class EntityExtractor {
    private llm: LLMProvider;

    constructor() {
        this.llm = LLMProvider.getInstance();
    }

    /**
     * Parse text and return extracted entities and relationships.
     */
    public async extract(text: string): Promise<ExtractedData> {
        if (!text || text.trim().length === 0) {
            return { entities: [], relationships: [] };
        }

        try {
            const response = await this.llm.generateChatCompletion(
                EXTRACTION_SYSTEM_PROMPT,
                `Extract from this text:\n"${text}"`,
                { jsonMode: true }
            );

            // Sanitize raw string (remove control characters, potential script tags)
            const sanitized = response
                .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control chars
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ""); // Remove <script>

            // Parse and validate
            const rawData = JSON.parse(sanitized);
            return EntityExtractionSchema.parse(rawData);
        } catch (error) {
            console.error('Entity extraction failed:', error);
            // Return empty result instead of crashing the whole addMemory flow
            return { entities: [], relationships: [] };
        }
    }
}
