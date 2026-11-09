# Mibase Checkout

Self-checkout on the member's phone: they open the site from a link or QR code, enter their member ID and PIN, then borrow or return toys by toy ID. No account login. Project rules: `.specify/memory/constitution.md`.

Same stack as the Mibase member portal (`MEM_V2`): React 18 + Vite 6 + Tailwind CSS v4 + React Router 7 frontend in `src/`, plain-PHP JSON API in `api_public/` served by XAMPP Apache, PostgreSQL.

## Layout

- `src/` — React app (`pages/`, `components/`, `context/`, `lib/`). API calls go through `src/lib/api.js`.
- `api_public/` — one PHP file per endpoint. `db.php` has `get_config()`, `get_db_connection()`, `read_json_body()`, `send_json()`, `send_json_error()`.
- `public/` — static files; `.htaccess` gives SPA fallback in production builds.

## Setup

1. The folder must be `C:\xampp\htdocs\mibase_checkout` (served at `http://localhost/mibase_checkout`). Start Apache and PostgreSQL.
2. Copy `api_public/config.sample.php` to `api_public/config.php` and set the DB credentials and the `self_checkout` section (gitignored). `self_checkout.photo_dir` must be outside `htdocs`.
3. PHP needs the GD extension (bundled with XAMPP): make sure `extension=gd` is not commented out in `C:\xampp\php\php.ini`, then restart Apache. `C:\xampp\php\php.exe -r "var_dump(extension_loaded('gd'));"` should print `true`.
4. Database tables: this repo's migrations live in `db/migrations/`. Take a backup (e.g. `php ../MEM_V2/db/backup.php <label>`), then run `php db/migrate.php` (`php db/migrate.php status` shows what's applied). History is kept in `public.self_checkout_migrations`, separate from MEM_V2's `schema_migrations`.
5. `npm install`
6. Optional, for mail/Claude/PayPal: `composer install --working-dir=api_public`

## Commands

```bash
npm run dev      # Vite on :5175, proxies /api_public to Apache
npm run build    # production build to dist/
```

## Running self-checkout for a library

- Turn it on with the library setting `mem_self_checkout = 'Yes'` (admin settings). Every endpoint refuses while it is `No`. Only the desk's general loan rules are implemented; libraries with their own extra desk rules (`ADMIN_V1/main/trans/loans/<library>_loans.php`) should keep it off.
- Share the app's public address (e.g. `https://<your-server>/mibase_checkout/`) as a link and as a QR code poster at the library; any QR generator works. Outside local development it must be served over **HTTPS** (member IDs and PINs are sent to it).
- Members need a 4-digit PIN (`borwrs.pin`), set by staff in the admin portal.
- Schedule `C:\xampp\php\php.exe C:\xampp\htdocs\mibase_checkout\db\purge_return_photos.php` to run daily (Windows Task Scheduler or cron). It deletes return photos after `self_checkout.photo_days` (90) days and clears old PIN-attempt rows.
- Staff view return photos, clear lockouts and manage PINs in the admin portal; what the admin portal needs is described in the feature's admin-portal contract (kept with the local spec documents).

Status endpoint: `http://localhost/mibase_checkout/api_public/status.php`.
