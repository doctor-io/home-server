-- Whether the push itself carries the alert text, or only a signal to go and
-- read it from this server.
--
-- Default false: the relay sees "something happened" and nothing else. An
-- operator who needs the text to survive a phone that cannot reach the server
-- turns it on knowingly.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_include_content" boolean DEFAULT false NOT NULL;
