<?php
// GET /api_public/status.php - is self-checkout on, and is there a live visit?
// Never creates or refreshes a session.
require_once __DIR__ . '/_checkout_session.php';

try {
    $pdo = get_db_connection();
    $visit = checkout_peek();
    $minutes = checkout_config()['session_minutes'];
    send_json([
        'enabled' => get_setting_yes($pdo, 'mem_self_checkout'),
        'library_name' => get_setting($pdo, 'libraryname'),
        'logo_url' => library_logo_url(),
        'session' => $visit ? [
            'first_name' => $visit['first_name'],
            'expires_in' => max(0, $minutes * 60 - (time() - $visit['last_activity'])),
        ] : null,
    ]);
} catch (Throwable $e) {
    error_log('status.php: ' . $e->getMessage());
    send_json_error('Something went wrong. Please try again.', 500);
}
