<?php
// CLI only. Deletes return photos (files + rows) older than self_checkout.photo_days
// (default 90, spec FR-018d) and stale self_checkout_attempts rows (older than one
// day and not locked). Run daily, e.g. Windows Task Scheduler:
//   C:\xampp\php\php.exe C:\xampp\htdocs\mibase_checkout\db\purge_return_photos.php
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit(1);
}
require __DIR__ . '/../api_public/db.php';

$cfg = checkout_config();
$pdo = get_db_connection();
$days = max(1, $cfg['photo_days']);

$old = $pdo->prepare("SELECT id, stored_path FROM public.self_checkout_return_photos
                       WHERE created_at < now() - make_interval(days => ?)");
$old->execute([$days]);
$deletedFiles = 0; $deletedRows = 0;
$del = $pdo->prepare('DELETE FROM public.self_checkout_return_photos WHERE id = ?');
foreach ($old->fetchAll() as $row) {
    $path = $cfg['photo_dir'] . '/' . $row['stored_path'];
    // stored_path is server-generated (YYYY/MM/<hex>.jpg); refuse anything else.
    if (preg_match('#^\d{4}/\d{2}/[0-9a-f]{32}\.jpg$#', $row['stored_path']) && is_file($path)) {
        if (@unlink($path)) $deletedFiles++;
    }
    $del->execute([$row['id']]);
    $deletedRows++;
}

$attempts = $pdo->exec("DELETE FROM public.self_checkout_attempts
                        WHERE window_start < now() - interval '1 day'
                          AND (locked_until IS NULL OR locked_until < now())");

echo "Return photos older than $days days: $deletedRows rows, $deletedFiles files deleted.\n";
echo "Stale attempt rows deleted: $attempts\n";
