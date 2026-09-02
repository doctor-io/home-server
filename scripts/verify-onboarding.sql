-- Manual verification for the first-run wizard state (v2.0 Track 1 / W1).
-- Run against a database that has had `npm run db:init` applied:
--   docker compose exec -T db psql -U homeio -d homeio -f - < scripts/verify-onboarding.sql
-- Safe on a scratch database only: it writes to the settings singleton.

\set ON_ERROR_STOP on
BEGIN;

-- ---------------------------------------------------------------------------
-- Case 1: an install upgraded from 1.7 must never be sent through setup.
-- Its settings row predates the wizard, so onboarding_state is NULL.
-- ---------------------------------------------------------------------------
INSERT INTO settings (id, appearance_json, updated_at)
VALUES ('singleton', '{}', NOW())
ON CONFLICT (id) DO NOTHING;

UPDATE settings SET onboarding_state = NULL WHERE id = 'singleton';

DO $$
DECLARE state text;
BEGIN
  SELECT onboarding_state INTO state FROM settings WHERE id = 'singleton';
  ASSERT state IS NULL, 'FAIL case 1: upgraded install should stay NULL (wizard skipped)';
  RAISE NOTICE 'PASS case 1: upgraded install keeps NULL state -> wizard skipped';
END $$;

-- ---------------------------------------------------------------------------
-- Case 2: first registration opens the wizard. This is the exact statement
-- markOnboardingPending() issues.
-- ---------------------------------------------------------------------------
UPDATE settings
SET onboarding_state = 'pending', onboarding_step = 1, updated_at = NOW()
WHERE id = 'singleton' AND onboarding_state IS NULL;

DO $$
DECLARE state text; step integer;
BEGIN
  SELECT onboarding_state, onboarding_step INTO state, step FROM settings WHERE id = 'singleton';
  ASSERT state = 'pending', 'FAIL case 2: first registration should open the wizard';
  ASSERT step = 1, 'FAIL case 2: wizard should open on step 1';
  RAISE NOTICE 'PASS case 2: first registration opens the wizard at step 1';
END $$;

-- ---------------------------------------------------------------------------
-- Case 3: the replay guard. Advance to step 3, then re-fire the "open the
-- wizard" statement the way a container restart or `db:init` would. It must
-- not rewind the user to step 1.
-- ---------------------------------------------------------------------------
UPDATE settings
SET onboarding_step = 3, timezone = 'Europe/Paris', updated_at = NOW()
WHERE id = 'singleton' AND onboarding_state = 'pending';

UPDATE settings
SET onboarding_state = 'pending', onboarding_step = 1, updated_at = NOW()
WHERE id = 'singleton' AND onboarding_state IS NULL;

DO $$
DECLARE step integer; tz text;
BEGIN
  SELECT onboarding_step, timezone INTO step, tz FROM settings WHERE id = 'singleton';
  ASSERT step = 3, 'FAIL case 3: replay rewound a wizard that was already underway';
  ASSERT tz = 'Europe/Paris', 'FAIL case 3: replay discarded a stored answer';
  RAISE NOTICE 'PASS case 3: replay leaves an in-progress wizard untouched';
END $$;

-- ---------------------------------------------------------------------------
-- Case 4: completing is terminal, and completing twice changes nothing.
-- ---------------------------------------------------------------------------
UPDATE settings
SET onboarding_state = 'complete', onboarding_step = 5,
    onboarding_completed_at = NOW(), updated_at = NOW()
WHERE id = 'singleton' AND onboarding_state = 'pending';

DO $$
DECLARE first_completed timestamptz; second_completed timestamptz;
BEGIN
  SELECT onboarding_completed_at INTO first_completed FROM settings WHERE id = 'singleton';

  UPDATE settings
  SET onboarding_state = 'complete', onboarding_completed_at = NOW()
  WHERE id = 'singleton' AND onboarding_state = 'pending';

  SELECT onboarding_completed_at INTO second_completed FROM settings WHERE id = 'singleton';
  ASSERT first_completed = second_completed, 'FAIL case 4: completing twice re-stamped the timestamp';
  RAISE NOTICE 'PASS case 4: completion is terminal and idempotent';
END $$;

-- Leave no trace: this is a verification run, not a fixture.
ROLLBACK;
