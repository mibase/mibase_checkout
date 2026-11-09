<?php
// Applies this repo's SQL migrations (db/migrations/NNNN_name.sql) to the
// database in api_public/config.php, recording each in
// public.self_checkout_migrations. Kept separate from MEM_V2's
// schema_migrations so the two apps' histories never mix.
//
//   php db/migrate.php            apply pending migrations
//   php db/migrate.php status     show applied / pending
//
// Each migration runs in its own transaction. Keep them idempotent and
// additive (IF NOT EXISTS, no changes to legacy tables), and never edit one
// that has been applied: add a new file instead. Take a backup first
// (e.g. php ../MEM_V2/db/backup.php <label>).
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

$command = $argv[1] ?? 'run';
if (!in_array($command, ['run', 'status'], true)) {
    fwrite(STDERR, "Unknown command '$command'. Use: run | status\n");
    exit(1);
}

$configPath = __DIR__ . '/../api_public/config.php';
if (!is_file($configPath)) {
    fwrite(STDERR, "api_public/config.php not found. Copy api_public/config.sample.php first.\n");
    exit(1);
}
$config = require $configPath;
$pdo = new PDO(
    sprintf('pgsql:host=%s;port=%d;dbname=%s', $config['host'], $config['port'], $config['dbname']),
    $config['user'],
    $config['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$pdo->exec('CREATE TABLE IF NOT EXISTS public.self_checkout_migrations (
    version varchar(255) PRIMARY KEY,
    checksum varchar(64) NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
)');

$files = glob(__DIR__ . '/migrations/*.sql') ?: [];
sort($files);
$applied = $pdo->query('SELECT version, checksum FROM public.self_checkout_migrations')->fetchAll(PDO::FETCH_KEY_PAIR);

echo "Database: {$config['dbname']}\n";
$pending = [];
foreach ($files as $file) {
    $version = basename($file, '.sql');
    // Ignore line endings so a CRLF checkout doesn't look like an edit.
    $checksum = hash('sha256', str_replace("\r\n", "\n", (string) file_get_contents($file)));
    if (!isset($applied[$version])) {
        $pending[$version] = [$file, $checksum];
        if ($command === 'status') echo "  PENDING  $version\n";
    } elseif ($applied[$version] !== $checksum) {
        echo "  CHANGED  $version (edited after it was applied - add a new migration instead)\n";
    } elseif ($command === 'status') {
        echo "  applied  $version\n";
    }
}

if ($command === 'status') {
    echo count($pending) . " pending.\n";
    exit(0);
}

foreach ($pending as $version => [$file, $checksum]) {
    echo "Applying $version ... ";
    try {
        $pdo->beginTransaction();
        $pdo->exec((string) file_get_contents($file));
        $pdo->prepare('INSERT INTO public.self_checkout_migrations (version, checksum) VALUES (?, ?)')
            ->execute([$version, $checksum]);
        $pdo->commit();
        echo "ok\n";
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo "FAILED\n";
        fwrite(STDERR, "$version: {$e->getMessage()}\nRolled back; later migrations were not run.\n");
        exit(1);
    }
}
echo count($pending) === 0 ? "Nothing to apply.\n" : count($pending) . " applied.\n";
