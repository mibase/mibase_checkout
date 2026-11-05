// Where the frontend finds the PHP API (api_public/). In dev, Vite proxies
// /api_public to Apache (see vite.config.js); a production build is served
// next to api_public/ under its base path, e.g. /mibase_checkout/api_public.
export const API_BASE = import.meta.env.DEV
  ? "/api_public"
  : `${import.meta.env.BASE_URL}api_public`;
