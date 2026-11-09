<?php
// POST /api_public/borrow.php {idcat, request_id} - borrow a toy for the
// verified member. All checks are repeated inside the write transaction.
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_desk_writes.php';

try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $body = read_json_body();
    $requestId = valid_request_id($body['request_id'] ?? '');
    $idcat = strtoupper(trim((string) ($body['idcat'] ?? '')));
    if ($requestId === null || $idcat === '') {
        send_json_error('Enter the toy ID from its label.', 400, 'INVALID_INPUT');
    }
    if ($previous = checkout_previous_result($requestId)) {
        send_json($previous['body'], $previous['status']);
    }

    $r = borrow_toy($pdo, (int) $visit['borid'], $idcat, checkout_config()['location']);
    if ($r['ok']) {
        unset($r['ok']);
        checkout_add_summary('borrowed', ['idcat' => $r['idcat'], 'name' => $r['name'], 'due' => $r['due']]);
        checkout_remember_result($requestId, ['status' => 200, 'body' => $r]);
        send_json($r);
    }
    $status = $r['code'] === 'NOT_FOUND' ? 404 : 409;
    $body = ['error' => refusal_message($r['code']), 'code' => $r['code']];
    checkout_remember_result($requestId, ['status' => $status, 'body' => $body]);
    send_json($body, $status);
} catch (Throwable $e) {
    error_log('borrow.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Nothing was borrowed. Please try again.', 500);
}
