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

export interface GeneratedTrivia {
  title: string;
  bodyMd: string;
  cards: GeneratedCard[];
  question: string;
  choices: string[];
  answer: string;
}

const CARDS_SCHEMA = {
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
};

const QUIZ_FIELDS = {
  question: { type: "string" },
  choices: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
  answer: { type: "string", description: "Must exactly match one of the choices." },
};

const ARTICLE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    bodyMd: { type: "string", description: "2-4 short paragraphs in Korean, written for a 20s social-newcomer reader." },
    cards: CARDS_SCHEMA,
    category: { type: "string", enum: ["finance", "housing", "seoul_life", "daily_tips"] },
    ...QUIZ_FIELDS,
  },
  required: ["title", "bodyMd", "cards", "category", "question", "choices", "answer"],
};

const TRIVIA_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    bodyMd: { type: "string", description: "2-4 short paragraphs in Korean, written for a 20s reader." },
    cards: CARDS_SCHEMA,
    ...QUIZ_FIELDS,
  },
  required: ["title", "bodyMd", "cards", "question", "choices", "answer"],
};

async function callGemini<T>(params: { apiKey: string; model: string; prompt: string; schema: object }): Promise<T> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: params.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: params.schema,
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

  return JSON.parse(text) as T;
}

export async function generateArticleAndQuiz(params: {
  sourceText: string;
  citationLabel: string;
  apiKey: string;
  model: string;
}): Promise<GeneratedContent> {
  const prompt = [
    "당신은 사회초년생을 위한 생활상식 큐레이션 서비스의 에디터입니다.",
    "아래 원본 자료를 바탕으로, 원문을 그대로 베끼지 말고 사회초년생이 이해하기 쉽게 새로 풀어 쓴 글과 복습용 4지선다 퀴즈 1개를 작성하세요.",
    "또한 같은 내용을 한눈에 훑어볼 수 있는 카드뉴스 형식(짧은 헤딩 + 1~2문장 본문, 3~5장)으로도 요약하세요.",
    `출처: ${params.citationLabel}`,
    "원본 자료:",
    params.sourceText,
  ].join("\n\n");

  return callGemini<GeneratedContent>({ apiKey: params.apiKey, model: params.model, prompt, schema: ARTICLE_RESPONSE_SCHEMA });
}

const TRIVIA_PROMPTS = {
  history: "한국 또는 세계 역사 속에서 사회초년생이 몰라서 아쉬울 만한, 흥미롭고 의외인 역사 상식 하나를 골라 설명하세요.",
  humor: "가볍게 웃으면서 배울 수 있는 유머러스한 상식이나 재미있는 사실 하나를 골라 설명하세요. 농담이 아니라 실제 사실이어야 합니다.",
  social_skills: "사회생활에서 흔히 오해하기 쉬운 매너, 공감, 대화법, 인간관계 상식 하나를 골라 \"왜 이게 중요한지\"까지 설명하세요. 설교하듯 쓰지 말고 실제 상황 예시로 설명하세요.",
  daily_tips: "집안일, 청소, 요리, 응급처치, 가전제품 사용처럼 자취/독립생활에 실제로 쓸 수 있는 생활 꿀팁 하나를 골라 설명하세요.",
} as const;

export async function generateTrivia(params: {
  category: keyof typeof TRIVIA_PROMPTS;
  avoidTitles: string[];
  apiKey: string;
  model: string;
}): Promise<GeneratedTrivia> {
  const prompt = [
    "당신은 사회초년생을 위한 생활상식 큐레이션 서비스의 에디터입니다.",
    TRIVIA_PROMPTS[params.category],
    "사실에 기반해야 하고, 평이하지 않은 주제를 고르세요.",
    "본문은 짧은 글과 카드뉴스(헤딩+1~2문장, 3~5장)로 요약하고, 복습용 4지선다 퀴즈 1개도 작성하세요.",
    params.avoidTitles.length > 0 ? `이미 다룬 주제이니 피하세요: ${params.avoidTitles.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return callGemini<GeneratedTrivia>({ apiKey: params.apiKey, model: params.model, prompt, schema: TRIVIA_RESPONSE_SCHEMA });
}
