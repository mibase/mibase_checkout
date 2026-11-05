# Mibase Checkout

Standalone self-checkout: a member enters their member ID and a toy ID to borrow a toy. No login.

Same stack as the Mibase member portal (`MEM_V2`): React 18 + Vite 6 + Tailwind CSS v4 + React Router 7 frontend in `src/`, plain-PHP JSON API in `api_public/` served by XAMPP Apache, PostgreSQL.

## Layout

- `src/` — React app (`pages/`, `components/`, `context/`, `lib/`). API calls go through `src/lib/api.js`.
- `api_public/` — one PHP file per endpoint. `db.php` has `get_config()`, `get_db_connection()`, `read_json_body()`, `send_json()`, `send_json_error()`.
- `public/` — static files; `.htaccess` gives SPA fallback in production builds.

## Setup

1. The folder must be `C:\xampp\htdocs\mibase_checkout` (served at `http://localhost/mibase_checkout`). Start Apache and PostgreSQL.
2. Copy `api_public/config.sample.php` to `api_public/config.php` and set the DB credentials (gitignored).
3. `npm install`
4. Optional, for mail/Claude/PayPal: `composer install --working-dir=api_public`

## Commands

```bash
npm run dev      # Vite on :5175, proxies /api_public to Apache
npm run build    # production build to dist/
```

Health check: `http://localhost/mibase_checkout/api_public/health.php`.
