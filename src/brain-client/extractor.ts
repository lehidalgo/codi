import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractionCandidate } from "./types.js";

export type { ExtractionCandidate };

/** Minimal duck-type of a Gemini model. Accepts either a prompt string or a
 *  `{contents: ...}` payload — matches the @google/generative-ai 0.24 shape. */
export interface GeminiModelLike {
  generateContent(
    input: string | { contents: Array<{ role: string; parts: Array<{ text: string }> }> },
  ): Promise<{ response: { text: () => string } }>;
}

export interface ExtractOptions {
  transcript: string;
  model: GeminiModelLike;
}

const PROMPT = `You are an assistant that extracts durable decisions from a developer's session transcript.

A "decision" is a deliberate choice the user made that future sessions should remember:
- technology, library, or tool choices
- architecture or design decisions
- root causes + fixes identified during debugging

Exclude exploratory discussion, questions, or ideas that were rejected.

For each decision return:
- title: concise (<200 chars)
- body: 1-3 sentences of context
- tags: 1-5 lowercase tags
- evidence_quote: EXACT substring from the transcript that justifies this
- confidence: 0.0-1.0
- type: "decision" | "fact" | "hot-state"

Return STRICT JSON: {"candidates": [{"title":"...","body":"...","tags":["..."],"evidence_quote":"...","confidence":0.0,"type":"decision"}]}
Return {"candidates": []} if none.`;

export function createGeminiModel(apiKey: string, modelName = "gemini-2.5-flash"): GeminiModelLike {
  const ai = new GoogleGenerativeAI(apiKey);
  return ai.getGenerativeModel({
    model: modelName,
    generationConfig: { responseMimeType: "application/json" },
  });
}

function normalizeForEvidence(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export async function extractWithGemini(opts: ExtractOptions): Promise<ExtractionCandidate[]> {
  const { transcript, model } = opts;
  const full = `${PROMPT}\n\n---TRANSCRIPT---\n${transcript}\n---END TRANSCRIPT---`;

  let raw: string;
  try {
    const result = await model.generateContent(full);
    raw = result.response.text();
  } catch {
    return [];
  }

  let parsed: { candidates?: unknown };
  try {
    parsed = JSON.parse(raw) as { candidates?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.candidates)) return [];

  const out: ExtractionCandidate[] = [];
  const transcriptNorm = normalizeForEvidence(transcript);
  for (const c of parsed.candidates) {
    const cand = c as Partial<ExtractionCandidate>;
    if (!cand.title || !cand.evidence_quote || cand.type === undefined) continue;
    const quoteNorm = normalizeForEvidence(cand.evidence_quote);
    const evidenceOk = transcriptNorm.includes(quoteNorm);
    out.push({
      title: cand.title,
      body: cand.body ?? "",
      tags: cand.tags ?? [],
      evidence_quote: cand.evidence_quote,
      confidence: evidenceOk ? Math.max(0, Math.min(1, cand.confidence ?? 0)) : 0,
      type: cand.type,
    });
  }
  return out;
}
