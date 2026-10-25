# Server Pages Frontend

A standalone Nuxt 2, Vue 2 and Vuetify 2 frontend prototype for configuring customer status pages and previewing their visitor-facing designs. It is independent from TeamPulse and contains no TeamPulse imports, middleware, or storage-key migration.

## Current architecture

- `pages/admin/index.vue` provides the Dashboard and Page Editor. It owns presentation state and calls `pageRepository` for page data.
- `pages/index.vue` redirects the site root to `/admin`. Visitor INDEX remains available from `/server-pages-preview/index/`.
- `pages/server-pages-preview/_type.vue` resolves the requested customer/page IDs and uses the same repository as the admin.
- `components/VisitorPage.vue` renders the visitor design shared by root INDEX and visitor preview.
- `data/templates.js` defines built-in page templates and three sample clients. Supported built-ins include INDEX, 404, 403, 500, MAINTENANCE, COMING SOON, and SUSPENDED.
- `services/pageRepository.js` is the data-access interface. Its current adapter is `services/demoPageRepository.js`; it exposes load/list/get/create/update/delete/setIndex/save/reset operations.
- utils/apiBaseUrl.js validates the shared URL in nuxt.config.js; @nuxtjs/axios consumes Nuxt public/private runtime config directly.
- plugins/legacy-client-api-settings.client.js removes obsolete per-client URL keys. Axios receives its base URL from Nuxt runtime config. There are currently no page HTTP requests and the repository mode remains demo.

## Demo data and safety

The demo repository stores each customer at `server-pages-standalone:v1:client:<clientId>`. The Dashboard, Editor and visitor pages read the same repository. Changes for one client do not write another client's record. Reset removes only the selected client's key. Browser localStorage is a prototype mechanism, not a security boundary, backup, or shared database. Production must authenticate users and enforce client authorization and tenant isolation on the backend for every operation.

Unreadable or invalid saved JSON is reported and left untouched. The UI does not silently replace it with unrelated defaults. New built-in templates are appended to a valid existing customer's collection without replacing that customer's existing content. Failed storage writes return an error; the admin retains its previous saved data and shows a message. Without browser storage (for example during server rendering), templates may be rendered for initial presentation, but no persistence is implied.

Only one enabled page may be marked INDEX. A missing or disabled INDEX is represented explicitly. The admin lets an operator select an enabled page; visitor INDEX displays an empty state until a valid choice is saved. Editing another page does not set INDEX.

The current image workflow validates PNG, JPEG, GIF and WebP files up to 2 MiB, reads them as a local data URL for demo preview, and saves that data URL in localStorage. No upload occurs. A future upload contract must agree on accepted formats and size limits, upload authorization, multipart or other request shape, response fields, URL lifetime/accessibility, and which returned URL field is stored as `design.imageUrl` or `design.logoUrl`. Processing or storage errors must leave the previous saved content unchanged.

## Shared backend URL and API preparation

The application has one shared Backend Base URL for all clients and pages. Nuxt 2 runtime config reads NUXT_PUBLIC_API_BASE_URL and passes it to the Axios module for browser and SSR requests. It is not stored per client and is not configured in the Admin UI. For local development, copy .env.example to .env and set the variable, or set it in the shell before npm run dev. In an SSR deployment, set the variable in the Nuxt Node process environment before npm run start; changing it requires restarting that process, not rebuilding the app. For static generation, runtime config is captured during generation, so regenerate when changing the URL. The value is public and must never contain secrets or tokens. public/runtime-config.js now contains only customer display defaults and does not override the API URL.

Obsolete browser-local per-client API URL keys are removed on application startup. This cleanup targets only the legacy server-pages-standalone:v1:client-api: prefix and leaves client page records and other browser data untouched.

The API page repository adapter is prepared to use the existing Nuxt Axios instance. createPageRepository({ mode: "api", axios, contract }) creates that adapter; the exported pageRepository remains in Demo mode until the Backend contract is approved and wired. Each operation, including save, needs a confirmed request builder and response mapper from the backend contract. The application remains in demo mode, uses client-scoped localStorage for page CRUD and visitor previews, and sends no page requests to a backend.

The visitor preview looks up an explicitly requested Page ID through the repository abstraction and verifies the returned type and client association when available. Custom Page IDs are frontend-generated demo identifiers; the backend must return or confirm authoritative IDs when the create API is integrated.

The backend contract must confirm paths and HTTP methods for listing pages, loading the client's INDEX configuration, retrieving one page by Page ID, creating, updating, deleting, selecting INDEX, and restoring defaults. It must also define request/response schemas, authoritative ID generation, error behavior, authentication and tenant authorization, domain-to-client resolution, public visitor data access, and image upload/storage behavior. Client-side filtering is not a security boundary.

The target frontend domain identifies where a visitor page is served; the shared backend base URL identifies the API server. No endpoint is generated for each page. A confirmed generic route will retrieve the selected page by its ID.

## Backend integration checklist

Before an API adapter is implemented, agree on:

1. Shared API base URL ownership by environment and deployment/runtime configuration lifecycle.
2. Authentication mechanism, session/token handling, roles, and authorization for each customer.
3. Client identity resolution and server-side tenant isolation.
4. Endpoints and HTTP methods for loading the complete page configuration, getting a page, create/update/delete, selecting INDEX, and restoring defaults.
5. Request/response schemas, stable IDs, validation rules, error format, conflict/version behavior, and pagination if needed.
6. Whether INDEX is stored as an explicit `indexPageId` or derived from page records, plus transaction/invariant rules.
7. Image upload route, formats/size limits, multipart fields, response URL fields, storage visibility, and URL expiry.
8. Which visitor content is public and how custom domains resolve to a customer.

These are open API decisions, not implemented assumptions. The adapter factory exists behind pageRepository; after the contract is confirmed, it can be wired without putting Axios or storage details into Vue components.

## Hosting responsibilities

A Vue route only draws a page. It does not return real HTTP 404, 403 or 500 status codes, enforce maintenance/suspended routing, bind DNS, provision TLS, or map a customer domain to tenant configuration. Those responsibilities require backend or hosting/platform routing. The current admin is a demo and is not protected; production must not expose page editing without authentication and server-side authorization. No server API, authentication, upload service, or live HTTP status routing is claimed as implemented.

## Commands

- `npm run dev`: local Nuxt server.
- `npm test`: focused repository and frontend behavior tests.
- `npm run build`: production Nuxt build.
- `npm run generate`: generate the static Vercel Demo into `dist`.
- `npm run start`: serve the production build.

Vercel uses `vercel.json` to run `npm run generate`, serve `dist`, redirect `/` to `/admin`, and fall back to the Nuxt client app for custom visitor preview types.
