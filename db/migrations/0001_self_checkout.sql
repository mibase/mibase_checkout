-- Member self-checkout support tables (mibase_checkout).
-- Applied with this repo's runner: php db/migrate.php (history in public.self_checkout_migrations).
-- Idempotent and additive only: no change to any existing legacy table. No foreign keys to legacy tables (they lack the constraints, and other
-- apps delete/merge rows); integrity is enforced by the self-checkout transactions.

-- Failed PIN attempts, per typed member ID and per client IP (lockouts).
CREATE TABLE IF NOT EXISTS public.self_checkout_attempts (
    scope varchar(10) NOT NULL,                     -- 'member' or 'ip'
    key varchar(64) NOT NULL,                       -- typed member id (exists or not) or client IP
    failed_count integer NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL DEFAULT now(),
    locked_until timestamptz,
    PRIMARY KEY (scope, key)
);

-- One photo per self-service return; files live outside the web root (config self_checkout.photo_dir).
CREATE TABLE IF NOT EXISTS public.self_checkout_return_photos (
    id bigserial PRIMARY KEY,
    transaction_id bigint NOT NULL UNIQUE,          -- public.transaction.id of the return
    borid bigint NOT NULL,
    idcat varchar NOT NULL,
    stored_path varchar(255) NOT NULL,              -- relative to photo_dir, e.g. 2026/11/<32 hex>.jpg
    bytes integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS self_checkout_return_photos_created_at_idx
    ON public.self_checkout_return_photos (created_at);
CREATE INDEX IF NOT EXISTS self_checkout_return_photos_borid_idx
    ON public.self_checkout_return_photos (borid);
