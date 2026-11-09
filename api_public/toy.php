<?php
// POST /api_public/toy.php {idcat} - look up a toy before borrowing (read-only).
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_desk_rules.php';

try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $idcat = strtoupper(trim((string) (read_json_body()['idcat'] ?? '')));
    $toy = $idcat !== '' ? load_toy($pdo, $idcat) : null;
    if (!$toy) {
        send_json_error(refusal_message('NOT_FOUND'), 404, 'NOT_FOUND');
    }
    $member = load_member($pdo, (int) $visit['borid']);
    $s = desk_settings($pdo);
    $check = borrow_check($pdo, $member, $toy, $s);
    $out = ['idcat' => $toy['idcat'], 'name' => $toy['toyname'], 'can_borrow' => $check['code'] === null];
    if ($check['code'] === null) {
        $out['due'] = due_date($member, $toy, $s);
    } else {
        $out['reason_code'] = $check['code'];
        $out['reason'] = refusal_message($check['code']);
    }
    send_json($out);
} catch (Throwable $e) {
    error_log('toy.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
