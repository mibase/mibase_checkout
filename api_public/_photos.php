<?php
// Return photos (research R8). Validated, re-encoded with GD (drops metadata
// and anything hidden in the file), saved under a server-generated name in
// self_checkout.photo_dir, which is outside the web root. Never served by
// this app; the admin portal shows them to staff.

require_once __DIR__ . '/db.php';

const PHOTO_MAX_SIDE = 1600;

// Returns null when OK, else 'PHOTO_REQUIRED' / 'PHOTO_INVALID'.
function photo_validate(?array $file, int $maxBytes): ?string {
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return 'PHOTO_REQUIRED';
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) return 'PHOTO_INVALID';
    if ($file['size'] <= 0 || $file['size'] > $maxBytes) return 'PHOTO_INVALID';
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!in_array($type, ['image/jpeg', 'image/png'], true)) return 'PHOTO_INVALID';
    $info = @getimagesize($file['tmp_name']);
    if (!$info || $info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > 40000000) return 'PHOTO_INVALID';
    return null;
}

// Re-encodes to a temp JPEG inside photo_dir. Returns [temp_path, stored_path, bytes].
function photo_prepare(array $file): array {
    $dir = checkout_config()['photo_dir'];
    if ($dir === '') throw new RuntimeException('self_checkout.photo_dir is not configured');
    $src = @imagecreatefromstring((string) file_get_contents($file['tmp_name']));
    if (!$src) throw new InvalidArgumentException('PHOTO_INVALID');

    $w = imagesx($src); $h = imagesy($src);
    $scale = min(1, PHOTO_MAX_SIDE / max($w, $h));
    $nw = max(1, (int) round($w * $scale)); $nh = max(1, (int) round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255)); // flatten PNG transparency
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    imagedestroy($src);

    $sub = date('Y') . '/' . date('m');
    if (!is_dir("$dir/$sub") && !mkdir("$dir/$sub", 0750, true) && !is_dir("$dir/$sub")) {
        throw new RuntimeException('Could not create photo folder');
    }
    $name = bin2hex(random_bytes(16)) . '.jpg';
    $temp = "$dir/$sub/.$name.tmp";
    if (!imagejpeg($dst, $temp, 82)) throw new RuntimeException('Could not save photo');
    imagedestroy($dst);
    return ['temp_path' => $temp, 'stored_path' => "$sub/$name", 'bytes' => filesize($temp)];
}

function photo_commit(array $p): void {
    $final = checkout_config()['photo_dir'] . '/' . $p['stored_path'];
    if (!rename($p['temp_path'], $final)) throw new RuntimeException('Could not finalise photo');
}

function photo_discard(?array $p): void {
    if ($p && is_file($p['temp_path'])) @unlink($p['temp_path']);
}
