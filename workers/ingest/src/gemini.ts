export interface GeneratedCard {
  heading: string;
  body: string;
}

export interface GeneratedContent {
  title: string;
  bodyMd: string;
  cards: GeneratedCard[];
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
    cards: {
      type: "array",
      description: "Card-news style slides summarizing bodyMd: each card is a short heading plus 1-2 skimmable sentences. 3 to 5 cards.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string", description: "Under 20 Korean characters." },
          body: { type: "string", description: "1-2 short sentences, easy to read at a glance." },
        },
        required: ["heading", "body"],
      },
      minItems: 3,
      maxItems: 5,
    },
    category: { type: "string", enum: ["finance", "housing", "seoul_life", "daily_tips"] },
    question: { type: "string" },
    choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
    answer: { type: "string", description: "Must exactly match one of the choices." },
  },
  required: ["title", "bodyMd", "cards", "category", "question", "choices", "answer"],
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
    "또한 같은 내용을 한눈에 훑어볼 수 있는 카드뉴스 형식(짧은 헤딩 + 1~2문장 본문, 3~5장)으로도 요약하세요.",
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
