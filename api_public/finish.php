<?php
// POST /api_public/finish.php - ends the visit (also fine with no session).
require_once __DIR__ . '/_checkout_session.php';

try {
    require_method('POST');
    checkout_end();
    send_json(['ok' => true]);
} catch (Throwable $e) {
    error_log('finish.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
