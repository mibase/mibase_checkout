<?php
// GET /api_public/summary.php - toys borrowed/returned in this visit. Does not
// end the visit (the summary is shown inside it, constitution IV).
require_once __DIR__ . '/_checkout_session.php';

try {
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $visit = checkout_require();
    send_json($visit['summary']);
} catch (Throwable $e) {
    error_log('summary.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
