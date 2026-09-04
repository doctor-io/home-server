/** What the settings UI is allowed to see: whether a token exists, never the token. */
export type PushConfigPublic = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  hasToken: boolean;
  /** False — the default — pushes a signal with no alert text in it. */
  includeContent: boolean;
};

export type PushConfigSaveRequest = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  includeContent?: boolean;
  /** Omitted leaves the stored token alone; null clears it. */
  ntfyToken?: string | null;
};

export type PushTestResponse = {
  delivered: true;
};
