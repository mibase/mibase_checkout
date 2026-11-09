<?php
// The verified visit (research R7): a server-side PHP session bound to one
// member, started after a correct member ID + PIN. It holds no PIN. Every
// state-changing request must also send the X-Checkout-Token header returned
// by verify.php (CSRF protection). Ends on Finish or after
// self_checkout.session_minutes without a request.

require_once __DIR__ . '/db.php';

function checkout_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $minutes = checkout_config()['session_minutes'];
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) (($minutes + 5) * 60));
    session_name(session_name_for_checkout());
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if (!session_start()) {
        throw new RuntimeException('Could not start self-checkout session.');
    }
}

// Starts a new visit for a verified member and returns the request secret.
function checkout_begin(int $borid, string $firstName): string {
    checkout_session_start();
    session_regenerate_id(true);
    $secret = bin2hex(random_bytes(32));
    $_SESSION = ['visit' => [
        'borid' => $borid,
        'first_name' => $firstName,
        'verified_at' => time(),
        'last_activity' => time(),
        'request_secret' => $secret,
        'summary' => ['borrowed' => [], 'returned' => []],
        'results' => [],
    ]];
    return $secret;
}

// The live visit or null, without refreshing it (status.php).
function checkout_peek(): ?array {
    if (!isset($_COOKIE[session_name_for_checkout()])) return null;
    checkout_session_start();
    $visit = $_SESSION['visit'] ?? null;
    if (!$visit || time() - $visit['last_activity'] > checkout_config()['session_minutes'] * 60) {
        return null;
    }
    return $visit;
}

function session_name_for_checkout(): string {
    return 'MIBASESELFCHECKOUT' . substr(hash('sha256', __DIR__), 0, 12);
}

// Requires a live visit and a matching X-Checkout-Token; refreshes the idle
// timer. Answers 401 SESSION_EXPIRED (and ends any stale session) otherwise.
function checkout_require(): array {
    checkout_session_start();
    $visit = $_SESSION['visit'] ?? null;
    $token = (string) ($_SERVER['HTTP_X_CHECKOUT_TOKEN'] ?? '');
    $idle = $visit ? time() - $visit['last_activity'] : PHP_INT_MAX;
    if (!$visit || $token === '' || !hash_equals($visit['request_secret'], $token)
        || $idle > checkout_config()['session_minutes'] * 60) {
        checkout_end();
        send_json_error('Your session ended. Please start again.', 401, 'SESSION_EXPIRED');
    }
    $_SESSION['visit']['last_activity'] = time();
    return $_SESSION['visit'];
}

function checkout_end(): void {
    checkout_session_start();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 3600, 'path' => $p['path'],
        'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict',
    ]);
    session_destroy();
}

function checkout_add_summary(string $list, array $item): void {
    $_SESSION['visit']['summary'][$list][] = $item;
}

// Retries after a lost connection reuse the client's request_id: the first
// result is replayed instead of borrowing/returning twice (research R10).
function checkout_previous_result(string $requestId): ?array {
    return $_SESSION['visit']['results'][$requestId] ?? null;
}

function checkout_remember_result(string $requestId, array $result): void {
    $results = $_SESSION['visit']['results'] ?? [];
    $results[$requestId] = $result;
    if (count($results) > 20) $results = array_slice($results, -20, null, true);
    $_SESSION['visit']['results'] = $results;
}

function valid_request_id($value): ?string {
    $value = (string) $value;
    return preg_match('/^[A-Za-z0-9-]{8,64}$/', $value) ? $value : null;
}
