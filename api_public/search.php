<?php
// POST /api_public/search.php {q} - find toys to borrow or return (FR-010a-e).
// Lists every matching toy across all statuses, exact toy ID first. Each row
// says what the member can do with it; rows they can't use carry only a general
// label, never who has the toy, when it is due back, or who reserved it.
// Read-only: borrow.php checks everything again when the member confirms.
require_once __DIR__ . '/_checkout_session.php';
require_once __DIR__ . '/_desk_rules.php';


// borrow_check codes that are about the toy, mapped to the label members see.
const SEARCH_LABELS = [
    'ON_LOAN' => 'On loan',
    'RESERVATION_TOY' => 'Reservation toy',
    'RESERVED' => 'Reserved',
    'HELD' => 'Reserved',
];

try {
    require_method('POST');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $q = trim((string) (read_json_body()['q'] ?? ''));
    if (mb_strlen($q) < 2 || mb_strlen($q) > 60) {
        send_json_error('Type at least 2 letters or numbers of the toy ID or name.', 400, 'INVALID_INPUT');
    }
    $like = '%' . strtr($q, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
    $stmt = $pdo->prepare(
        "SELECT idcat FROM public.toys
          WHERE (idcat ILIKE ? OR toyname ILIKE ?)
          ORDER BY (upper(idcat) = upper(?)) DESC, idcat");
    $stmt->execute([$like, $like, $q]);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $s = desk_settings($pdo);
    $member = load_member($pdo, (int) $visit['borid']);
    // The same toy checks as the desk, without the member's own limits: a member at
    // their limit (or not active) still sees which toys are available, and is
    // refused with the reason when they tap Borrow (US2/AC5, AC6).
    $probe = array_merge($member, [
        'member_status' => 'ACTIVE', 'expired' => null, 'gold_star' => 0,
        'toys_onloan' => 0, 'weight_loans' => 0, 'maxnoitems' => PHP_INT_MAX,
    ]);

    $results = [];
    foreach ($ids as $idcat) {
        $toy = load_toy($pdo, $idcat);
        if (!$toy) continue;
        $code = borrow_check($pdo, $probe, $toy, $s)['code'];
        $row = ['idcat' => $toy['idcat'], 'name' => $toy['toyname'], 'toy_status' => trim((string) ($toy['toy_status'] ?? '')), 'alert' => trim((string) ($toy['alert'] ?? '')), 'image_url' => toy_image_url($toy['idcat'])];
        if ($code === null) {
            $row['action'] = 'borrow';
            $row['due'] = due_date($member, $toy, $s);
        } elseif ($code === 'ALREADY_YOURS') {
            $row['action'] = 'return';
        } else {
            $row['action'] = 'none';
            $row['status_label'] = SEARCH_LABELS[$code] ?? 'Not available';
        }
        $results[] = $row;
    }
    send_json(['results' => $results]);
} catch (Throwable $e) {
    error_log('search.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
