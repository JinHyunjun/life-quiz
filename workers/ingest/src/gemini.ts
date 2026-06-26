export interface GeneratedContent {
  title: string;
  bodyMd: string;
  category: "finance" | "housing" | "seoul_life" | "daily_tips";
  question: string;
  choices: string[];
  answer: string;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    bodyMd: { type: "string", description: "2-4 short paragraphs in Korean, written for a 20s social-newcomer reader." },
    category: { type: "string", enum: ["finance", "housing", "seoul_life", "daily_tips"] },
    question: { type: "string" },
    choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
    answer: { type: "string", description: "Must exactly match one of the choices." },
  },
  required: ["title", "bodyMd", "category", "question", "choices", "answer"],
};

export async function generateArticleAndQuiz(params: {
  sourceText: string;
  citationLabel: string;
  apiKey: string;
  model: string;
}): Promise<GeneratedContent> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

  const prompt = [
    "당신은 사회초년생을 위한 생활상식 큐레이션 서비스의 에디터입니다.",
    "아래 원본 자료를 바탕으로, 원문을 그대로 베끼지 말고 사회초년생이 이해하기 쉽게 새로 풀어 쓴 글과 복습용 4지선다 퀴즈 1개를 작성하세요.",
    `출처: ${params.citationLabel}`,
    "원본 자료:",
    params.sourceText,
  ].join("\n\n");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response had no content");
  }

  return JSON.parse(text) as GeneratedContent;
}
