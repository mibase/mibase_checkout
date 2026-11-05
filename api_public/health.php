<?php
// GET /api_public/health.php - confirms PHP runs and the database is reachable.
require_once __DIR__ . '/db.php';

$result = ['php' => PHP_VERSION, 'db' => false];
try {
    get_db_connection()->query('SELECT 1');
    $result['db'] = true;
} catch (Throwable $e) {
    error_log('health.php: ' . $e->getMessage());
    $result['db_error'] = $e instanceof RuntimeException ? $e->getMessage() : 'connection failed';
}
send_json($result);
