# Anonymous Comment Wall

![Playwright Tests](https://github.com/3dendroid/Comment-Wall/actions/workflows/playwright.yml/badge.svg)

A small Flask app for posting anonymous comments.

Live: https://commentwall.up.railway.app/

Features: bad-words filter, rate limiting, comment timestamps, "Load older" pagination, your own comments marked "You" (remembered in your browser), light and dark themes (follows the device setting until you pick one), admin mode for deleting comments, and a Make fun button (spinning cats + music, click again to stop).
Storage: PostgreSQL in production, SQLite fallback for local runs.

## Project structure

```
comment-wall/
├── app.py
├── templates/
│   └── index.html
├── static/                # page CSS/JS, site icon, cat gif + music for the Make fun button
│   ├── style.css
│   ├── theme.js           # loaded in <head>: sets the theme before the page is drawn
│   ├── app.js             # everything else the page does
│   └── fonts/             # IBM Plex, self-hosted (SIL OFL 1.1, see OFL.txt)
│   ├── cat.gif
│   └── cat.mp3
├── bad_words.txt
├── requirements.txt
├── requirements-dev.txt   # pytest
├── Procfile               # Railway deployment
├── Dockerfile             # container image
├── .dockerignore
├── k8s/                   # namespace, deployment, service
├── tests/                 # API tests (pytest)
├── e2e/                   # Playwright tests
│   ├── pages/
│   │   └── CommentWallPage.ts  # Page Object
│   ├── fixtures.ts             # custom fixture "wall"
│   ├── commentwall.spec.ts     # UI tests + UI vs API check
│   ├── buttons.spec.ts         # button tests
│   ├── api.spec.ts             # negative API tests
│   ├── ux.spec.ts              # network errors, theme, reduced motion, icon, fonts, double click
│   ├── security.spec.ts        # CSP header, no CSP violations, admin delete
│   └── db.spec.ts              # API vs database check
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── .github/workflows/
    ├── playwright.yml     # CI: pytest + Playwright against a local server
    └── smoke.yml          # manual read-only checks of production
```

## Run with Docker / Podman

```bash
podman build -t comment-wall:v1 .
podman run -d --name comment-wall -p 8080:8000 comment-wall:v1
```

Open http://localhost:8080

## Run on Kubernetes

The deployment reads `DATABASE_URL` and `ADMIN_TOKEN` from a secret named `comment-wall`:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n comment-wall create secret generic comment-wall --from-literal=DATABASE_URL='postgresql://...' --from-literal=ADMIN_TOKEN='...'
kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
```

## API

| Request                         | What it does                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `GET /comments`                 | all comments, newest first: `{id, text, created_at}`                          |
| `GET /comments?limit=50`        | one page (1–100); continue with `&before=<id of the oldest comment you have>` |
| `POST /comments` `{"text": …}`  | add a comment: 1–500 characters, a string, no bad words                       |
| `DELETE /comments/<id>`         | delete, needs `Authorization: Bearer <ADMIN_TOKEN>`                           |

Rate limits per client IP: 1 `POST` per 5 seconds, 60 `GET /comments` per minute, 10 failed admin attempts per minute.
The app trusts one proxy hop (`X-Forwarded-For`), as on Railway.

Every response carries a strict `Content-Security-Policy` (`default-src 'self'`, no inline scripts or styles), `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`. Keep page code in `static/`: an inline `<script>`, `style="…"` or `onclick=` would be blocked.

## Configuration

| Variable       | Purpose                      | Default               |
| -------------- | ---------------------------- | --------------------- |
| `DATABASE_URL` | PostgreSQL connection string | SQLite in `instance/` |
| `ADMIN_TOKEN`  | token for admin mode         | —                     |
| `REDIS_URL`    | rate-limit storage           | in memory             |

## Tests

### API tests (pytest)

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest -q tests
```

They use a temporary SQLite database and check validation, rate limits, pagination, admin access and the bad-words filter.

### End-to-end tests (Playwright + TypeScript)

By default Playwright starts the app locally (`python app.py` on port 20000) and tests it, so every pull request is tested with its own code.

UI tests use the **Page Object Model** (`e2e/pages/`) and a **custom fixture** `wall` (`e2e/fixtures.ts`). The fixture creates the page object and opens the page before the test.

| File                  | What it checks                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `commentwall.spec.ts` | page title, input placeholder, character counter, page shows the API's first page, a new comment appears right away and is marked "You" |
| `buttons.spec.ts`     | Post, admin and theme buttons; the theme button switches the theme; the admin button opens the sign-in dialog |
| `security.spec.ts`    | strict Content-Security-Policy is sent, using the page triggers no CSP violations, an admin can sign in and delete a comment |
| `ux.spec.ts`          | network errors are shown, theme is set before the page is drawn and follows the device, cats don't spin with "reduce motion", site icon loads, fonts come from this site, a double click posts once |
| `api.spec.ts`         | `DELETE` without token → 401; `POST` with empty, non-string or too long text → 400                        |
| `db.spec.ts`          | number of comments in the API = number of rows in PostgreSQL                                             |

```bash
npm ci
npx playwright install chromium
npx playwright test
npx playwright show-report
```

| Variable           | Purpose                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `E2E_DATABASE_URL` | database of the local test server; SQLite (`instance/e2e.db`) if unset. `db.spec.ts` runs only with PostgreSQL |
| `BASE_URL`         | test a deployed site instead of starting one; tests that write data are skipped              |
| `DATABASE_URL`     | used by `db.spec.ts` only together with `BASE_URL` (the production database)                 |
| `PYTHON`           | Python command for the local server, `python` by default                                     |

The local test server gets a throwaway `ADMIN_TOKEN` (`e2e-admin-token`) for the admin tests and never receives `DATABASE_URL`, so a production URL in `.env` is safe: tests can't write to the production database by accident.
`.env` is in `.gitignore` and `.dockerignore`, so it is never committed or copied into the image.

### CI

`playwright.yml` runs on every pull request and push to `main`: pytest, then Playwright against the app started in the job with a throwaway PostgreSQL service.
`main` is protected: a pull request can't be merged until the tests pass.

`smoke.yml` runs the read-only Playwright tests against https://commentwall.up.railway.app/ — start it by hand in Actions after a deploy. It takes `DATABASE_URL` from the encrypted repository secret.
