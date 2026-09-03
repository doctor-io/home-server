/** What the settings UI is allowed to see: whether a token exists, never the token. */
export type PushConfigPublic = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  hasToken: boolean;
};

export type PushConfigSaveRequest = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  /** Omitted leaves the stored token alone; null clears it. */
  ntfyToken?: string | null;
};

export type PushTestResponse = {
  delivered: true;
};
