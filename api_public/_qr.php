<?php
require_once __DIR__ . '/_checkout_session.php';

// A QR grant permits login for 10 minutes; a verified visit has its own expiry.
function checkout_qr_allowed(): bool {
    checkout_session_start();
    return (int) ($_SESSION['qr_expires'] ?? 0) > time();
}

function checkout_require_qr(): void {
    if (!checkout_qr_allowed()) {
        send_json_error('Please scan the QR code at the library to start.', 403, 'QR_REQUIRED');
    }
}