/**
 * LLM helper — calls Gemini directly via @google/generative-ai SDK.
 *
 * Note on Antigravity: Antigravity is the *IDE* used to build/iterate agents
 * during development. The deployed runtime calls Gemini directly with this
 * helper. Agent prompts + tool definitions authored in the IDE are imported
 * into the codebase (or duplicated) — the runtime path is just Gemini.
 *
 * Falls back to a deterministic mock if no key is configured, so the app
 * still runs offline / in CI / before the team has a Gemini key.
 */
import { z } from 'zod';
import { env, isGeminiConfigured } from '@/lib/env';

interface GenerateArgs<T extends z.ZodTypeAny> {
  systemInstruction: string;
  userPrompt: string;
  schema: T;
  model?: string;
  runId?: string;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function generateStructured<T extends z.ZodTypeAny>(args: GenerateArgs<T>): Promise<z.infer<T>> {
  if (isGeminiConfigured()) {
    try {
      return await callGeminiDirect(args);
    } catch (e) {
      console.warn('[llm] Gemini call failed; using mock fallback:', (e as Error).message);
      return mockResponse(args.schema);
    }
  }
  console.warn('[llm] GOOGLE_GEMINI_API_KEY not set; returning deterministic mock');
  return mockResponse(args.schema);
}

async function callGeminiDirect<T extends z.ZodTypeAny>(args: GenerateArgs<T>): Promise<z.infer<T>> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(env.GOOGLE_GEMINI_API_KEY!);
  const model = client.getGenerativeModel({ model: args.model || DEFAULT_MODEL });
  const res = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: args.userPrompt }] }],
    systemInstruction: { role: 'system', parts: [{ text: args.systemInstruction }] },
    generationConfig: { responseMimeType: 'application/json' },
  });
  const text = res.response.text();
  return args.schema.parse(JSON.parse(text));
}

function mockResponse<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  try {
    return generateMockFromZod(schema) as z.infer<T>;
  } catch (e) {
    throw new Error(`[llm mock] could not synthesize for schema: ${(e as Error).message}`);
  }
}

function generateMockFromZod(schema: z.ZodTypeAny): unknown {
  const def = (schema as { _def: { typeName: string } })._def;
  switch (def.typeName) {
    case 'ZodString': return 'mock';
    case 'ZodNumber': return 0.5;
    case 'ZodBoolean': return true;
    case 'ZodArray': return [];
    case 'ZodEnum': return (def as unknown as { values: string[] }).values[0];
    case 'ZodObject': {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(shape)) {
        out[k] = generateMockFromZod(v as z.ZodTypeAny);
      }
      return out;
    }
    case 'ZodOptional':
    case 'ZodDefault':
    case 'ZodNullable': {
      const inner = (def as unknown as { innerType: z.ZodTypeAny }).innerType;
      return generateMockFromZod(inner);
    }
    case 'ZodRecord': return {};
    case 'ZodUnknown':
    case 'ZodAny': return null;
    default: return null;
  }
}
