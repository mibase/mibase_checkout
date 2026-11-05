<?php
// Shared helpers for all api_public/ endpoints.

// Endpoints return JSON, so PHP notices must never be printed into the
// response. They go to PHP's error log (XAMPP: apache/logs/error.log).
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// config.php, loaded once per request.
function get_config(): array {
    static $config = null;
    if ($config === null) {
        $path = __DIR__ . '/config.php';
        if (!is_file($path)) {
            throw new RuntimeException('api_public/config.php is missing - copy config.sample.php');
        }
        $config = require $path;
    }
    return $config;
}

function get_db_connection(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $config = get_config();
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $config['host'], $config['port'], $config['dbname']);
    $pdo = new PDO($dsn, $config['user'], $config['password']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('SET search_path TO public');
    return $pdo;
}

function read_json_body(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function send_json($data): void {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    echo json_encode($data);
    exit;
}

function send_json_error(string $message, int $status = 500): void {
    http_response_code($status);
    send_json(['error' => $message]);
}
