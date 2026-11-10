<?php
// GET /api_public/loans.php - the verified member's current loans (for Return).
require_once __DIR__ . '/_checkout_session.php';

try {
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $stmt = $pdo->prepare(
        "SELECT t.id AS transaction_id, t.idcat, coalesce(toys.toyname, t.item, t.idcat) AS name,
                t.due, toys.toy_status, coalesce(toys.alert, '') AS alert, (t.due < current_date) AS overdue
           FROM public.transaction t
           LEFT JOIN public.toys ON upper(toys.idcat) = upper(t.idcat)
          WHERE t.borid = ? AND t.return IS NULL
          ORDER BY t.due, t.id");
    $stmt->execute([(int) $visit['borid']]);
    $loans = array_map(fn($r) => [
        'transaction_id' => (int) $r['transaction_id'],
        'idcat' => $r['idcat'],
        'name' => $r['name'],
        'alert' => trim((string) $r['alert']),
        'toy_status' => trim((string) ($r['toy_status'] ?? '')),
        'image_url' => toy_image_url($r['idcat']),
        'due' => $r['due'],
        'overdue' => (bool) $r['overdue'],
    ], $stmt->fetchAll());
    // Member number and borrowing limit for "203: Michelle" and "Total toys N of M"
    // (FR-015). Nothing else about the member.
    $limit = $pdo->prepare('SELECT coalesce(m.maxnoitems, 0) FROM public.borwrs b
                              LEFT JOIN public.membertype m ON m.membertype = b.membertype WHERE b.id = ?');
    $limit->execute([(int) $visit['borid']]);
    send_json([
        'loans' => $loans,
        'returns_enabled' => strcasecmp(get_setting($pdo, 'mem_returns'), 'No') !== 0,
        'member_id' => (int) $visit['borid'],
        'max_items' => (int) $limit->fetchColumn(),
        'count' => count($loans),
    ]);
} catch (Throwable $e) {
    error_log('loans.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
