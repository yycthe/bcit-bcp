/**
 * xAI REST / message shapes (documentation mirrors only — not used at runtime).
 * @see https://docs.x.ai/docs/guides/chat-completions
 * @see https://docs.x.ai/docs/guides/files
 * @see https://docs.x.ai/docs/guides/structured-outputs
 */

/** Chat Completions: one text segment in a multipart `content` array */
export type XaiChatContentTextPart = {
  type: 'text';
  text: string;
};

/** Chat Completions: image (data URL or HTTPS), per xAI image guide */
export type XaiChatContentImageUrlPart = {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
};

export type XaiChatUserContentPart = XaiChatContentTextPart | XaiChatContentImageUrlPart;

export type XaiChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string | XaiChatUserContentPart[];
};

/** POST /v1/chat/completions — minimal request body (text + multimodal) */
export type XaiChatCompletionsRequest = {
  model: string;
  messages: XaiChatMessage[];
  stream?: boolean;
  max_completion_tokens?: number | null;
  temperature?: number | null;
  /** Structured outputs — exact shape depends on schema; see xAI structured outputs guide */
  response_format?: unknown;
};

/** Responses API: user turn with file reference (after POST /v1/files) */
export type XaiResponsesInputTextPart = {
  type: 'input_text';
  text: string;
};

export type XaiResponsesInputFilePart = {
  type: 'input_file';
  file_id: string;
};

export type XaiResponsesUserContentPart = XaiResponsesInputTextPart | XaiResponsesInputFilePart;

export type XaiResponsesInputMessage = {
  role: 'user';
  content: XaiResponsesUserContentPart[];
};

/** POST /v1/responses — body fragment for file-backed Q&A (per Files guide) */
export type XaiResponsesCreateBody = {
  model: string;
  input: string | XaiResponsesInputMessage[];
  stream?: boolean;
  /** Structured text output on Responses API — see xAI docs */
  text?: { format?: unknown };
};
