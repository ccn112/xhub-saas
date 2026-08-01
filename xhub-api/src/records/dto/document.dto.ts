/**
 * Records request bodies. Inline-interface style (mirrors controlplane / mdm /
 * backup — no class-validator). Content is provided either as UTF-8 `content`
 * or base64 `contentBase64`; exactly one is used (contentBase64 wins).
 */
export interface CreateDocumentDto {
  kind?: string;
  title: string;
  subjectType?: string;
  subjectId?: string;
  tags?: string[];
  mimeType?: string;
  content?: string;
  contentBase64?: string;
}

export interface AddVersionDto {
  mimeType?: string;
  content?: string;
  contentBase64?: string;
}
