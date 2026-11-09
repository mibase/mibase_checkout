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

// The self_checkout section of config.php with defaults filled in.
function checkout_config(): array {
    $c = get_config()['self_checkout'] ?? [];
    return [
        'photo_dir' => rtrim((string) ($c['photo_dir'] ?? ''), '/\\'),
        'location' => (string) ($c['location'] ?? ''),
        'session_minutes' => (int) ($c['session_minutes'] ?? 10),
        'photo_days' => (int) ($c['photo_days'] ?? 90),
        'max_photo_bytes' => (int) ($c['max_photo_bytes'] ?? 5242880),
    ];
}

// One connection per request. Unqualified names resolve to public, but all
// self-checkout SQL is written with explicit public. names anyway.
// The library's timezone (settings.timezone) is applied to PHP and to the
// database session so "today" means the same thing in both, as the desk expects.
function get_db_connection(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $config = get_config();
    $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $config['host'], $config['port'], $config['dbname']);
    $pdo = new PDO($dsn, $config['user'], $config['password']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('SET search_path TO public');

    $tz = get_setting($pdo, 'timezone');
    if ($tz !== '' && in_array($tz, timezone_identifiers_list(), true)) {
        date_default_timezone_set($tz);
        $pdo->prepare('SELECT set_config(\'TimeZone\', ?, false)')->execute([$tz]);
    }
    return $pdo;
}

// One setting by name (settings also holds admin secrets: never read whole rows).
function get_setting(PDO $pdo, string $name, string $default = ''): string {
    $stmt = $pdo->prepare('SELECT setting_value FROM public.settings WHERE setting_name = ? ORDER BY id LIMIT 1');
    $stmt->execute([$name]);
    $value = $stmt->fetchColumn();
    return ($value === false || $value === null) ? $default : trim((string) $value);
}

// The library's logo for the header (FR-020a): config library.logo_url, the same
// value the member portal uses. Only http(s) URLs or root-relative paths; '' if none.
function library_logo_url(): string {
    $value = trim((string) (get_config()['library']['logo_url'] ?? ''));
    return preg_match('#^(https?://|/(?!/))#i', $value) ? $value : '';
}

// Toy photos, the same way the member portal finds them (MEM_V2 db.php):
// <prefix><idcat lower-case>.jpg, where the prefix is config images_path, else
// /toy_images/<library.toy_images_dir>/, else /toy_images/.
function toy_image_prefix(): string {
    $config = get_config();
    $path = trim((string) ($config['images_path'] ?? ''));
    if ($path !== '') return rtrim($path, '/') . '/';
    $dir = trim((string) ($config['library']['toy_images_dir'] ?? ''));
    return $dir !== '' ? '/toy_images/' . rawurlencode($dir) . '/' : '/toy_images/';
}

// The toy's photo URL, or '' when there is none. A photo on this server is only
// returned if the file exists, so the page never shows a broken image; one on
// another host (images_path with http) is returned as is.
function toy_image_url(string $idcat): string {
    $url = toy_image_prefix() . rawurlencode(strtolower(trim($idcat))) . '.jpg';
    if (preg_match('#^https?://#i', $url)) return $url;
    $root = rtrim((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''), '/\\');
    if ($root === '') return '';
    return is_file($root . rawurldecode($url)) ? $url : '';
}

function get_setting_yes(PDO $pdo, string $name): bool {
    return strcasecmp(get_setting($pdo, $name), 'Yes') === 0;
}

// The library's own on/off switch for member self-checkout (research R4).
function require_self_checkout_enabled(PDO $pdo): void {
    if (!get_setting_yes($pdo, 'mem_self_checkout')) {
        send_json_error('Self-checkout is not available right now. Please see a volunteer.', 503, 'SELF_CHECKOUT_OFF');
    }
}

function read_json_body(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function send_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    echo json_encode($data);
    exit;
}

function send_json_error(string $message, int $status = 500, ?string $code = null): void {
    $body = ['error' => $message];
    if ($code !== null) $body['code'] = $code;
    send_json($body, $status);
}

function require_method(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        send_json_error('Method not allowed.', 405, 'METHOD');
    }
}

// New ids for legacy tables (constitution II). Legacy writers mix MAX(id)+1
// (e.g. desk new_holdid() for toy_holds) with sequence defaults, so a sequence
// can lag behind the data. Inside the caller's transaction: lock the table, take
// the larger of MAX(id)+1 and nextval, and move the sequence forward if it was
// behind. Ported from MEM_V2 api_public/_legacy_writes.php.
function legacy_allocate_id(PDO $pdo, string $table, string $column = 'id'): int {
    $allowed = ['transaction' => 'id', 'journal' => 'id', 'toy_holds' => 'id'];
    if (($allowed[$table] ?? null) !== $column || !$pdo->inTransaction()) {
        throw new InvalidArgumentException('Invalid legacy ID allocation.');
    }
    $pdo->exec("LOCK TABLE public.\"{$table}\" IN SHARE ROW EXCLUSIVE MODE");
    $id = (int) $pdo->query("SELECT COALESCE(MAX(\"{$column}\"), 0) + 1 FROM public.\"{$table}\"")->fetchColumn();

    // Legacy columns use a plain nextval('...') default rather than an owned
    // sequence, so pg_get_serial_sequence() is NULL for them: read the default.
    $stmt = $pdo->prepare("SELECT column_default FROM information_schema.columns
                           WHERE table_schema = 'public' AND table_name = ? AND column_name = ?");
    $stmt->execute([$table, $column]);
    $default = (string) $stmt->fetchColumn();
    $sequence = preg_match("/nextval\\('([^']+)'::regclass\\)/", $default, $m) ? $m[1] : null;
    if ($sequence) {
        $next = $pdo->prepare('SELECT nextval(CAST(? AS regclass))');
        $next->execute([$sequence]);
        $sequenceId = (int) $next->fetchColumn();
        if ($sequenceId > $id) {
            $id = $sequenceId;
        } elseif ($id > $sequenceId) {
            $pdo->prepare('SELECT setval(CAST(? AS regclass), ?, true)')->execute([$sequence, $id]);
        }
    }
    return $id;
}
