<?php
// Copy this file to config.php and fill in your local values.
// config.php is gitignored - never commit real credentials.

return [
    'host' => 'localhost',
    'port' => 5432,
    'dbname' => 'demo',
    'user' => 'postgres',
    'password' => 'CHANGE_ME',

    // Optional - only for the db/ tools (backup, restore, clone). Set these if
    // pg_dump isn't found automatically, or to keep backups somewhere other
    // than ~/mibase-backups. Keep backups outside the project folder.
    // 'pg_bin' => 'C:/Program Files/PostgreSQL/18/bin',
    // 'backup_dir' => 'D:/mibase-backups',

    // Get sandbox credentials from a PayPal REST app at
    // developer.paypal.com/dashboard/applications/sandbox. 'mode' is
    // 'sandbox' or 'live' - switch to 'live' only with live credentials.
    'paypal' => [
        'client_id' => 'CHANGE_ME',
        'client_secret' => 'CHANGE_ME',
        'mode' => 'sandbox',
        'currency' => 'AUD',
    ],

    // Optional - shown on the logged-out home page. The library's name comes
    // from the database (settings.libraryname); these three do not, so set them
    // per library. Leave a value empty to hide it. Each must be an http(s) URL
    // or a path starting with "/" (e.g. '/images/carlson/logo.png').
    'library' => [
        'logo_url' => '',
        'website_url' => '',      // the library's own website, when it has one
        'admin_login_url' => '',  // where staff log in to the admin

        // Toy photos live in toy_images/<toy_images_dir>/<idcat>.jpg. Leave
        // empty to use the shared toy_images/ folder directly (no subfolder).
        'toy_images_dir' => '',

        // The membership type (by name) that people signing up in the portal
        // start on. Must match a name in the library's membership types.
        'signup_membership_type' => 'GENERAL MEMBER',
    ],

    // Claude API for the chat widget (api_public/chat.php). The widget answers from
    // its built-in common questions first and only calls Claude when none
    // match. Get a key at console.anthropic.com. Leave 'api_key' as CHANGE_ME
    // to turn the AI fallback off - the widget then keeps its canned reply.
    // 'effort' is low | medium | high; 'low' is plenty for short FAQ replies.
    'anthropic' => [
        'api_key' => 'CHANGE_ME',
        'model' => 'claude-opus-5',
        'effort' => 'low',
    ],

    // Gmail SMTP for 2FA codes and payment receipts. 'app_password' is a
    // 16-character app password from myaccount.google.com/apppasswords
    // (requires 2-Step Verification on) - NOT your normal Gmail password.
    'mail' => [
        'host' => 'smtp.gmail.com',
        'port' => 587,
        'username' => 'CHANGE_ME@gmail.com',
        'app_password' => 'CHANGE_ME',
        'from_email' => 'CHANGE_ME@gmail.com',
        'from_name' => 'Mibase',
    ],

    // Member self-checkout (borrow/return on the member's phone).
    'self_checkout' => [
        // Where return photos are saved. MUST be outside the web root (htdocs) so no URL can
        // reach them; the admin portal reads them from here. Created on first use.
        'photo_dir' => 'C:/xampp/mibase_data/return_photos',
        // Written to transaction.location / borwrs.location / toys.location, like the desk's
        // staff location. Most desk loans use '' (empty); set a branch code if your library uses one.
        'location' => '',
        'session_minutes' => 10,      // verified visit ends after this many idle minutes
        'photo_days' => 90,           // return photos are deleted after this many days
        'max_photo_bytes' => 5242880, // 5 MB upload limit
    ],
];
