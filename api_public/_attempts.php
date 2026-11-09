<?php
// PIN-guessing limits (research R6, spec FR-006/FR-007), stored in
// public.self_checkout_attempts. 'member' rows are keyed by the TYPED member
// ID whether or not that member exists, so lockouts never reveal which IDs
// are real. 'ip' rows limit guessing across many IDs from one client.

require_once __DIR__ . '/db.php';

const ATTEMPT_WINDOW_MINUTES = 15;
const ATTEMPT_LOCK_MINUTES = 15;
const ATTEMPT_LIMITS = ['member' => 5, 'ip' => 20];

function attempts_is_locked(PDO $pdo, string $scope, string $key): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM public.self_checkout_attempts
                           WHERE scope = ? AND key = ? AND locked_until > now()');
    $stmt->execute([$scope, $key]);
    return (bool) $stmt->fetchColumn();
}

function attempts_fail(PDO $pdo, string $scope, string $key): void {
    $limit = ATTEMPT_LIMITS[$scope];
    $window = ATTEMPT_WINDOW_MINUTES . ' minutes';
    $lock = ATTEMPT_LOCK_MINUTES . ' minutes';
    $stmt = $pdo->prepare(
        "INSERT INTO public.self_checkout_attempts AS a (scope, key, failed_count, window_start)
         VALUES (:scope, :key, 1, now())
         ON CONFLICT (scope, key) DO UPDATE SET
             failed_count = CASE WHEN a.window_start < now() - interval '$window' THEN 1
                                 ELSE a.failed_count + 1 END,
             window_start = CASE WHEN a.window_start < now() - interval '$window' THEN now()
                                 ELSE a.window_start END
         RETURNING failed_count"
    );
    $stmt->execute(['scope' => $scope, 'key' => $key]);
    if ((int) $stmt->fetchColumn() >= $limit) {
        $pdo->prepare("UPDATE public.self_checkout_attempts
                       SET locked_until = now() + interval '$lock', failed_count = 0, window_start = now()
                       WHERE scope = ? AND key = ?")->execute([$scope, $key]);
    }
}

function attempts_clear(PDO $pdo, string $scope, string $key): void {
    $pdo->prepare('DELETE FROM public.self_checkout_attempts WHERE scope = ? AND key = ?')
        ->execute([$scope, $key]);
}

// The connecting client only; forwarded headers are not trusted (a reverse
// proxy would need explicit configuration before honouring them).
function client_ip(): string {
    return substr((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64);
}
