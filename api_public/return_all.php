<?php
// POST /api_public/return_all.php (multipart: transaction_ids = "1,2,3", request_id, photo)
// Return All (FR-016a): returns every listed loan of the verified member with one
// photo of all the toys together. Each loan is checked and recorded on its own;
// ones that can't be returned are listed in not_returned and the rest still go through.
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_desk_writes.php';

const RETURN_ALL_MAX = 50;

$photo = null;
try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $requestId = valid_request_id($_POST['request_id'] ?? '');
    $raw = array_filter(array_map('trim', explode(',', (string) ($_POST['transaction_ids'] ?? ''))), 'strlen');
    $ids = [];
    foreach ($raw as $v) {
        if (!ctype_digit($v)) $ids = null;
        if ($ids === null) break;
        $ids[(int) $v] = (int) $v;
    }
    if ($requestId === null || !$ids || count($ids) > RETURN_ALL_MAX) {
        send_json_error('Choose the toys you are returning.', 400, 'INVALID_INPUT');
    }
    if ($previous = checkout_previous_result($requestId)) {
        send_json($previous['body'], $previous['status']);
    }

    $cfg = checkout_config();
    $bad = photo_validate($_FILES['photo'] ?? null, $cfg['max_photo_bytes']);
    if ($bad === 'PHOTO_REQUIRED') {
        send_json_error('Please take a photo of the toys to return them.', 400, 'PHOTO_REQUIRED');
    }
    if ($bad !== null) {
        send_json_error("That photo didn't work. Please take the photo again.", 400, 'PHOTO_INVALID');
    }
    try {
        $photo = photo_prepare($_FILES['photo']);
    } catch (InvalidArgumentException $e) {
        send_json_error("That photo didn't work. Please take the photo again.", 400, 'PHOTO_INVALID');
    }

    $r = return_all_self($pdo, (int) $visit['borid'], array_values($ids), $photo, $cfg['location']);
    $photo = null; // committed or discarded
    foreach ($r['returned'] as $item) {
        checkout_add_summary('returned', ['idcat' => $item['idcat'], 'name' => $item['name'], 'late' => $item['late']]);
    }
    if (!$r['returned']) {
        $body = ['error' => "These toys aren't on loan to you. Please see a volunteer.", 'code' => 'NOT_ON_LOAN_TO_YOU'];
        checkout_remember_result($requestId, ['status' => 409, 'body' => $body]);
        send_json($body, 409);
    }
    checkout_remember_result($requestId, ['status' => 200, 'body' => $r]);
    send_json($r);
} catch (Throwable $e) {
    photo_discard($photo);
    error_log('return_all.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please check your toys list and try again.', 500);
}
