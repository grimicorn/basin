-- Race-proof backstop for the Free-plan source cap. The application guard in
-- server/utils/feedLimit.ts (assertWithinFeedLimit) counts then inserts in two
-- separate statements; neon-http is stateless (no interactive transaction), so
-- two concurrent adds at exactly the limit can both pass the count and land the
-- account one over. This trigger closes that window at the DB layer: it
-- serializes concurrent adds per user with a transaction-scoped advisory lock
-- so the count always reflects every already-committed add. The app guard stays
-- as the fast path that returns a clean 403 without a failed insert.
--
-- It fires AFTER INSERT (not BEFORE) for two reasons: (1) a BEFORE FOR EACH ROW
-- trigger can't see the sibling rows of a multi-row INSERT (they share its
-- command id), so a single batched insert could walk past the cap — an AFTER
-- trigger counts the fully-applied statement; (2) re-adding a source the user
-- already follows resolves to an ON CONFLICT DO UPDATE, which fires UPDATE (not
-- INSERT) triggers, so a re-add is never counted against the cap without any
-- explicit special-case. On any over-cap row it raises, rolling back the whole
-- statement.
--
-- The literal 10 below mirrors FREE_PLAN_FEED_LIMIT in server/utils/feedLimit.ts
-- (a SQL migration can't import the TS constant) — keep the two in sync. The
-- raised message text mirrors FEED_LIMIT_DB_ERROR_MARKER in the same file; the
-- app matches on it (plus the SQLSTATE) to translate this DB error into the
-- same 403.
--
-- Tables are schema-qualified and search_path is pinned (with pg_temp last) so
-- the reads can't be shadowed by a same-named temp table or a caller's altered
-- search_path (CVE-2018-1058 shape).
CREATE OR REPLACE FUNCTION feeds_enforce_source_cap()
RETURNS trigger AS $$
BEGIN
  -- Any paid plan is unlimited (mirrors getAccountPlan: unlimited when a
  -- subscription row exists with a non-free plan). Checked before the lock so
  -- Pro adds are never serialized.
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = NEW.user_id AND plan <> 'free'
  ) THEN
    RETURN NULL;
  END IF;

  -- Serialize concurrent adds for this user so the count reflects every
  -- already-committed add. pg_advisory_xact_lock is transaction-scoped (released
  -- on commit/rollback), so it is safe under connection pooling and never leaks.
  -- The classid arg namespaces the lock to this feature so it can't collide with
  -- an advisory lock taken elsewhere for the same user_id.
  PERFORM pg_advisory_xact_lock(hashtext('feeds_source_cap'), NEW.user_id);

  -- Strictly greater-than: the just-inserted row is already counted, so a user
  -- reaching exactly 10 is fine and the 11th is what trips this.
  IF (SELECT count(*) FROM public.feeds WHERE user_id = NEW.user_id) > 10 THEN
    RAISE EXCEPTION 'free_plan_feed_limit_exceeded'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp;
--> statement-breakpoint

DROP TRIGGER IF EXISTS feeds_enforce_source_cap_trigger ON "feeds";
--> statement-breakpoint

CREATE TRIGGER feeds_enforce_source_cap_trigger
AFTER INSERT ON "feeds"
FOR EACH ROW EXECUTE FUNCTION feeds_enforce_source_cap();
