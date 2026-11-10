<?php
require_once __DIR__ . '/api_public/_qr.php';
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
try {
    require_method('GET');
    $pdo = get_db_connection();
    require_self_checkout_enabled($pdo);
    $key = get_setting($pdo, 'key');
    $provided = $_GET['key'] ?? null;
    if ($key === '' || !is_string($provided) || !hash_equals($key . '001', $provided)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'This QR code is invalid. Please scan the QR code at the library.';
        exit;
    }
    checkout_session_start();
    session_regenerate_id(true);
    $_SESSION = ['qr_expires' => time() + 600];
    header('Location: /mibase_checkout/', true, 303);
    exit;
} catch (Throwable $e) {
    error_log('checkqr.php: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Could not start checkout. Please see a volunteer.';
}