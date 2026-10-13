
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: string;
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "The Gemini API key is missing from .env.local." },
        { status: 500 }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase environment settings are missing." },
        { status: 500 }
      );
    }

    // Keep the existing sign-in check.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please sign in before generating a quiz." },
        { status: 401 }
      );
    }

    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseKey,
        Authorization: authorization,
      },
      cache: "no-store",
    });

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: "Your session is invalid. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const text = body.text;
    const title = body.title;
    const subject = body.subject;

    if (
      typeof text !== "string" ||
      text.trim().length < 300 ||
      text.length > 45000
    ) {
      return NextResponse.json(
        { error: "The study material is too short or too long." },
        { status: 400 }
      );
    }

    const prompt = `
You are an expert school teacher and assessment designer.

Create high-quality multiple-choice questions using ONLY
the study material provided below.

RESOURCE TITLE: ${String(title || "Study resource").slice(0, 200)}
SUBJECT: ${String(subject || "General").slice(0, 100)}

QUESTION QUALITY RULES:
- Aim for exactly 10 questions.
- Include 3 Easy, 4 Medium, and 3 Hard questions when the
  material supports that many good questions.
- If the material does not support 10 good questions, return
  fewer rather than inventing facts.
- Test genuine understanding, not just memorisation.
- Hard questions should require reasoning, applying concepts,
  interpreting evidence, or connecting related ideas.
- Use realistic scenarios and application questions when suitable.
- Make incorrect options plausible and based on common mistakes.
- Avoid silly, obviously wrong, repetitive, vague, or trick options.
- Do not repeatedly ask what a word means or what a heading says.
- Do not invent facts that are not supported by the material.
- Do not ask the same thing in different wording.
- Each question must have exactly 4 distinct answer options.
- Exactly one option must be correct.
- "answer" must be the zero-based index of the correct option.
- Explanations must explain WHY the answer is correct using
  the supplied material.
- Write questions appropriate for a school student studying
  this subject.

Return ONLY valid JSON, without Markdown or code fences, in this format:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explanation grounded in the material",
      "difficulty": "Easy"
    }
  ]
}

Difficulty must be exactly Easy, Medium, or Hard.
The top-level object must contain a "questions" array.

STUDY MATERIAL:
${text}
`;

    // Use Google's newer Interactions API.
    const aiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: "gemini-3.7-flash",
          input: prompt,
          generation_config: {
            temperature: 0.4,
          },
        }),
        cache: "no-store",
      }
    );

    const aiResult = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("Gemini API error:", aiResult);

      return NextResponse.json(
        {
          error:
            aiResult.error?.message ||
            "Gemini could not generate the quiz. Please try again.",
        },
        { status: 502 }
      );
    }

    // The Interactions API returns generated text in model_output steps.
    const steps = Array.isArray(aiResult.steps) ? aiResult.steps : [];

    const generatedText = steps
      .filter(
        (step: { type?: string }) => step.type === "model_output"
      )
      .flatMap(
        (step: { content?: { type?: string; text?: string }[] }) =>
          Array.isArray(step.content) ? step.content : []
      )
      .filter(
        (part: { type?: string; text?: string }) =>
          part.type === "text" && typeof part.text === "string"
      )
      .map((part: { text?: string }) => part.text || "")
      .join("")
      .trim();

    if (!generatedText) {
      console.error("Gemini returned no text output.");

      return NextResponse.json(
        { error: "The AI returned an empty response. Please try again." },
        { status: 502 }
      );
    }

    let parsed: { questions?: unknown };

    try {
      // Also handle a response wrapped in Markdown fences, just in case.
      const cleanedText = generatedText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();

      parsed = JSON.parse(cleanedText);
    } catch {
      console.error("Gemini returned invalid JSON.");

      return NextResponse.json(
        {
          error:
            "The AI returned an invalid response. Please try again.",
        },
        { status: 502 }
      );
    }

    if (!Array.isArray(parsed.questions)) {
      return NextResponse.json(
        { error: "The AI response did not contain a valid question list." },
        { status: 502 }
      );
    }

    // Keep only questions that match the format expected by the quiz page.
    const questions: Question[] = parsed.questions
      .filter((item): item is Question => {
        if (!item || typeof item !== "object") return false;

        const q = item as Record<string, unknown>;

        return (
          typeof q.question === "string" &&
          q.question.trim().length > 0 &&
          Array.isArray(q.options) &&
          q.options.length === 4 &&
          q.options.every(
            (option) =>
              typeof option === "string" && option.trim().length > 0
          ) &&
          new Set(
            (q.options as string[]).map((option) =>
              option.trim().toLowerCase()
            )
          ).size === 4 &&
          Number.isInteger(q.answer) &&
          (q.answer as number) >= 0 &&
          (q.answer as number) <= 3 &&
          typeof q.explanation === "string" &&
          q.explanation.trim().length > 0 &&
          ["Easy", "Medium", "Hard"].includes(String(q.difficulty))
        );
      })
      .slice(0, 10);

    if (questions.length < 5) {
      return NextResponse.json(
        {
          error:
            "The AI could not create at least 5 reliable questions from this material. Try a different PDF with clearer notes.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Quiz generation failed:", error);

    return NextResponse.json(
      { error: "Something went wrong while generating the quiz." },
      { status: 500 }
    );
  }
}
