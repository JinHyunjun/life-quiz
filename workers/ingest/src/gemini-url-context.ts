export interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string }> };
  urlContextMetadata?: GeminiUrlContextMetadata;
  url_context_metadata?: GeminiUrlContextMetadata;
}

interface GeminiUrlContextMetadata {
  urlMetadata?: Array<{ urlRetrievalStatus?: string }>;
  url_metadata?: Array<{ url_retrieval_status?: string }>;
}

export function hasSuccessfulUrlContext(candidate: GeminiCandidate | undefined) {
  const metadata = candidate?.urlContextMetadata ?? candidate?.url_context_metadata;
  const statuses = [
    ...(metadata?.urlMetadata?.map((entry) => entry.urlRetrievalStatus) ?? []),
    ...(metadata?.url_metadata?.map((entry) => entry.url_retrieval_status) ?? []),
  ];
  return statuses.includes("URL_RETRIEVAL_STATUS_SUCCESS");
}
