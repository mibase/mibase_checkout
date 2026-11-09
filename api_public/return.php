<?php
// POST /api_public/return.php (multipart: transaction_id or idcat, request_id, photo)
// Returns a toy on loan to the verified member. A photo is required (FR-018a).
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_desk_writes.php';

$photo = null;
try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $requestId = valid_request_id($_POST['request_id'] ?? '');
    $transactionId = ctype_digit((string) ($_POST['transaction_id'] ?? '')) ? (int) $_POST['transaction_id'] : null;
    $idcat = strtoupper(trim((string) ($_POST['idcat'] ?? '')));
    if ($requestId === null || (!$transactionId && $idcat === '')) {
        send_json_error('Choose the toy you are returning.', 400, 'INVALID_INPUT');
    }
    if ($previous = checkout_previous_result($requestId)) {
        send_json($previous['body'], $previous['status']);
    }

    $cfg = checkout_config();
    $bad = photo_validate($_FILES['photo'] ?? null, $cfg['max_photo_bytes']);
    if ($bad === 'PHOTO_REQUIRED') {
        send_json_error('Please take a photo of the toy to return it.', 400, 'PHOTO_REQUIRED');
    }
    if ($bad !== null) {
        send_json_error("That photo didn't work. Please take the photo again.", 400, 'PHOTO_INVALID');
    }
    try {
        $photo = photo_prepare($_FILES['photo']);
    } catch (InvalidArgumentException $e) {
        send_json_error("That photo didn't work. Please take the photo again.", 400, 'PHOTO_INVALID');
    }

    $r = return_toy_self($pdo, (int) $visit['borid'], $transactionId, $idcat, $photo, $cfg['location']);
    $photo = null; // committed or already discarded
    if ($r['ok']) {
        unset($r['ok']);
        checkout_add_summary('returned', ['idcat' => $r['idcat'], 'name' => $r['name'], 'late' => $r['late']]);
        checkout_remember_result($requestId, ['status' => 200, 'body' => $r]);
        send_json($r);
    }
    $body = ['error' => "This toy isn't on loan to you. Please see a volunteer.", 'code' => 'NOT_ON_LOAN_TO_YOU'];
    checkout_remember_result($requestId, ['status' => 409, 'body' => $body]);
    send_json($body, 409);
} catch (Throwable $e) {
    photo_discard($photo);
    error_log('return.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Nothing was returned. Please try again.', 500);
}
