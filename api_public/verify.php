<?php
// POST /api_public/verify.php {member_id, pin} - starts a verified visit.
// Unknown ID, wrong PIN and "no PIN set" all get the same answer, the same
// delay, and count against the typed member ID, so nothing reveals whether an
// ID exists (constitution I/III, spec FR-004..FR-007). The PIN is never logged
// or stored.
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_attempts.php';
require_once __DIR__ . '/_desk_rules.php';

const BAD_CREDENTIALS_MESSAGE = "Member ID or PIN is incorrect. If you don't have a PIN, please see a volunteer.";
const LOCKED_MESSAGE = 'Too many attempts. Please wait 15 minutes and try again, or see a volunteer.';

function fail_slowly(string $message, int $status, string $code): void {
    usleep(300000);
    send_json_error($message, $status, $code);
}

try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);

    $body = read_json_body();
    $memberId = trim((string) ($body['member_id'] ?? ''));
    $pin = trim((string) ($body['pin'] ?? ''));
    $ip = client_ip();

    if (attempts_is_locked($pdo, 'ip', $ip)) {
        fail_slowly(LOCKED_MESSAGE, 429, 'LOCKED');
    }
    if (!preg_match('/^\d{1,10}$/', $memberId) || !preg_match('/^\d{4}$/', $pin)) {
        attempts_fail($pdo, 'ip', $ip);
        fail_slowly('Enter your member number and your 4-digit PIN.', 400, 'INVALID_INPUT');
    }
    $memberKey = ltrim($memberId, '0') === '' ? '0' : ltrim($memberId, '0');
    if (attempts_is_locked($pdo, 'member', $memberKey)) {
        fail_slowly(LOCKED_MESSAGE, 429, 'LOCKED');
    }

    $member = load_member($pdo, (int) $memberKey);
    $storedPin = ($member && $member['pin'] !== null) ? str_pad((string) $member['pin'], 4, '0', STR_PAD_LEFT) : null;
    // Always run the comparison so timing doesn't differ for unknown IDs.
    $ok = hash_equals($storedPin ?? 'xxxx', $pin) && $storedPin !== null;

    if (!$ok) {
        attempts_fail($pdo, 'member', $memberKey);
        attempts_fail($pdo, 'ip', $ip);
        fail_slowly(BAD_CREDENTIALS_MESSAGE, 401, 'BAD_CREDENTIALS');
    }

    attempts_clear($pdo, 'member', $memberKey);
    $firstName = trim((string) $member['firstname']);
    $token = checkout_begin((int) $member['id'], $firstName);
    send_json([
        'first_name' => $firstName,
        'token' => $token,
        'expires_in' => checkout_config()['session_minutes'] * 60,
    ]);
} catch (Throwable $e) {
    error_log('verify.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
