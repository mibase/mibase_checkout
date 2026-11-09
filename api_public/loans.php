<?php
// GET /api_public/loans.php - the verified member's current loans (for Return).
require_once __DIR__ . '/_checkout_session.php';

try {
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();

    $stmt = $pdo->prepare(
        "SELECT t.id AS transaction_id, t.idcat, coalesce(toys.toyname, t.item, t.idcat) AS name,
                t.due, (t.due < current_date) AS overdue
           FROM public.transaction t
           LEFT JOIN public.toys ON upper(toys.idcat) = upper(t.idcat)
          WHERE t.borid = ? AND t.return IS NULL
          ORDER BY t.due, t.id");
    $stmt->execute([(int) $visit['borid']]);
    $loans = array_map(fn($r) => [
        'transaction_id' => (int) $r['transaction_id'],
        'idcat' => $r['idcat'],
        'name' => $r['name'],
        'due' => $r['due'],
        'overdue' => (bool) $r['overdue'],
    ], $stmt->fetchAll());
    send_json(['loans' => $loans]);
} catch (Throwable $e) {
    error_log('loans.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
