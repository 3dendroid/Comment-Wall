# Anonymous Comment Wall

![Playwright Tests](https://github.com/3dendroid/Comment-Wall/actions/workflows/playwright.yml/badge.svg)

A small Flask app for posting anonymous comments.

**Live:** https://comment-wall.com/

## Features

- Anonymous comments up to 500 characters, newest first, with timestamps
- Live updates every 5 seconds; your own new comment shows up right away
- Your own comments are marked "You" (remembered in your browser only)
- "Load older comments" pagination
- Bad-words filter, also catching spaced (`f u c k`) and stretched (`fuuuck`) spellings
- Rate limiting per visitor
- Light and dark themes, following the device setting until you pick one
- Clear messages when the network is down or you post too fast
- Admin mode (lock icon) for deleting comments
- A Make fun button: spinning cats and music, click again to stop (no spinning with "reduce motion")

**Stack:** Python 3.12, Flask, SQLAlchemy, Flask-Limiter, gunicorn. PostgreSQL in production, SQLite for local runs. No front-end framework: plain HTML, CSS and JavaScript.

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:20000. Without `DATABASE_URL` the app uses SQLite in `instance/comments.db`.
To try admin mode, start it with a token, e.g. `ADMIN_TOKEN=secret python app.py`, and sign in with the lock icon.

### With Docker / Podman

```bash
podman build -t comment-wall:v1 .
podman run -d --name comment-wall -p 8080:8000 comment-wall:v1
```

Open http://localhost:8080. The container runs gunicorn as an unprivileged user.

### On Kubernetes

The deployment reads `DATABASE_URL` and `ADMIN_TOKEN` from a secret named `comment-wall`:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n comment-wall create secret generic comment-wall --from-literal=DATABASE_URL='postgresql://...' --from-literal=ADMIN_TOKEN='...'
kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
```

The readiness probe uses `/healthz`, so a pod stops receiving traffic while the database is unreachable. Liveness is a plain TCP check, so a database outage doesn't restart pods.

## Configuration

| Variable       | Purpose                                    | Default                                    |
| -------------- | ------------------------------------------ | ------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string               | SQLite in `instance/comments.db`           |
| `ADMIN_TOKEN`  | token for admin mode; unset = admin is off | —                                          |
| `PORT`         | port to listen on                          | `20000` (`python app.py`), `8000` (Docker) |
| `REDIS_URL`    | rate-limit storage, needed with >1 replica | in memory                                  |

## API

| Request                        | What it does                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `GET /comments`                | all comments, newest first: `{id, text, created_at}`                                  |
| `GET /comments?limit=50`       | one page (1–100); continue with `&before=<id of the oldest comment you have>`         |
| `POST /comments` `{"text": …}` | add a comment: a string of 1–500 characters with no bad words                          |
| `DELETE /comments/<id>`        | delete a comment; needs `Authorization: Bearer <ADMIN_TOKEN>`                         |
| `POST /admin-verify`           | check an admin token without changing anything (used by the sign-in dialog)          |
| `GET /healthz`                 | `200 {"status": "ok"}`, or `503` when the database is unreachable; never rate limited |

Rate limits per client IP: 1 `POST` per 5 seconds, 60 `GET /comments` per minute, 10 failed admin attempts per minute. The app trusts one proxy hop (`X-Forwarded-For`), as on Railway.

Older databases are upgraded on start: the `created_at` column is added if it's missing. Comments from before that have no timestamp.

## Security

- Every response carries a strict `Content-Security-Policy` (`default-src 'self'`, no inline code), `X-Content-Type-Options: nosniff` and `Referrer-Policy: same-origin`. **Keep page code in `static/`**: an inline `<script>`, `style="…"` or `onclick=` in the template would be blocked by the browser.
- Comment text is always inserted as text, never as HTML.
- The admin token is compared in constant time and has no default; failed attempts are rate limited.
- Fonts are self-hosted, so visitors' browsers don't contact Google.

## Tests

### API tests (pytest)

```bash
pip install -r requirements.txt -r requirements-dev.txt
ruff check .
pytest -q tests
```

They use a temporary SQLite database and cover validation, rate limits, pagination, admin access, the bad-words filter, security headers, `/healthz`, and upgrading an old database.

### End-to-end tests (Playwright + TypeScript)

```bash
npm ci
npm run typecheck
npx playwright install chromium
npx playwright test
npx playwright show-report
```

By default Playwright starts the app locally (`python app.py` on port 20000) and tests it, so every pull request is tested with its own code. UI tests use the **Page Object Model** (`e2e/pages/`) and a **custom fixture** `wall` (`e2e/fixtures.ts`) that creates the page object and opens the page.

| File                  | What it checks                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commentwall.spec.ts` | page title, input placeholder, character counter, page shows the API's first page, a new comment appears right away and is marked "You"              |
| `buttons.spec.ts`     | Post, admin and theme buttons; the theme button switches the theme; the admin button opens the sign-in dialog                                        |
| `ux.spec.ts`          | network errors are shown, theme is set before the page is drawn and follows the device, no spinning with "reduce motion", site icon, self-hosted fonts, a double click posts once |
| `security.spec.ts`    | strict CSP is sent, using the page triggers no CSP violations, an admin can sign in and delete a comment                                              |
| `api.spec.ts`         | `DELETE` without token → 401; `POST` with empty, non-string or too long text → 400                                                                   |
| `db.spec.ts`          | number of comments in the API = number of rows in PostgreSQL                                                                                         |

| Variable           | Purpose                                                                                                          |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `E2E_DATABASE_URL` | database of the local test server; SQLite (`instance/e2e.db`) if unset. `db.spec.ts` runs only with PostgreSQL  |
| `BASE_URL`         | test a deployed site instead of starting one; tests that write data are skipped                                  |
| `DATABASE_URL`     | used by `db.spec.ts` only together with `BASE_URL` (the production database)                                     |
| `PYTHON`           | Python command for the local server, `python` by default                                                         |

The local test server gets a throwaway `ADMIN_TOKEN` (`e2e-admin-token`) for the admin tests and never receives `DATABASE_URL`, so a production URL in `.env` is safe: tests can't write to the production database by accident. `.env` is in `.gitignore` and `.dockerignore`, so it is never committed or copied into the image.

### CI

- `playwright.yml` runs on every pull request and push to `main`: ruff and pytest, then `tsc` and Playwright against the app started in the job with a throwaway PostgreSQL service. `main` is protected: a pull request can't be merged until it passes.
- `smoke.yml` runs the read-only Playwright tests against https://comment-wall.com/. Start it by hand (Actions → Production smoke tests → Run workflow) after a deploy. It takes `DATABASE_URL` from the encrypted repository secret.

## Deployment

The app runs on [Railway](https://railway.app), which deploys `main` with the `Procfile` (gunicorn on Railway's `PORT`) and provides PostgreSQL through `DATABASE_URL`.

The domain `comment-wall.com` is registered at Porkbun (auto-renew on) and points at the Railway service: an `ALIAS` record on the root to the Railway target, plus a `_railway-verify` TXT record. Railway issues and renews the HTTPS certificate. The Railway address https://commentwall.up.railway.app/ still works too.

## Maintenance

- **Dependencies:** Dependabot opens weekly PRs for pip, npm and GitHub Actions (minor and patch versions grouped; major versions come one by one). They run through the same CI: merge them when it's green, and read the release notes of major updates first.
- **Bad-words list:** `bad_words.txt` is built by `bad_words_generator.py` from the [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) lists. To rebuild it: `pip install requests && python bad_words_generator.py`. Ordinary words that cause false positives go into `EXCLUDE` in that script.

## Project structure

```
comment-wall/
├── app.py                     # Flask app: routes, model, rate limits, security headers
├── templates/
│   └── index.html             # page markup only (no inline code)
├── static/
│   ├── style.css
│   ├── theme.js               # loaded in <head>: sets the theme before the page is drawn
│   ├── app.js                 # everything else the page does
│   ├── favicon.svg
│   ├── fonts/                 # IBM Plex, self-hosted (SIL OFL 1.1, see OFL.txt)
│   ├── cat.gif                # for the Make fun button
│   └── cat.mp3
├── bad_words.txt
├── bad_words_generator.py     # rebuilds bad_words.txt
├── requirements.txt
├── requirements-dev.txt       # pytest, ruff
├── pyproject.toml             # ruff settings
├── Procfile                   # Railway
├── Dockerfile
├── .dockerignore
├── k8s/                       # namespace, deployment, service
├── tests/                     # API tests (pytest)
│   ├── conftest.py
│   └── test_app.py
├── e2e/                       # Playwright tests
│   ├── pages/
│   │   └── CommentWallPage.ts # Page Object
│   ├── fixtures.ts            # custom fixture "wall"
│   ├── commentwall.spec.ts
│   ├── buttons.spec.ts
│   ├── ux.spec.ts
│   ├── security.spec.ts
│   ├── api.spec.ts
│   └── db.spec.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── .github/
    ├── dependabot.yml         # weekly update PRs
    └── workflows/
        ├── playwright.yml     # CI
        └── smoke.yml          # manual checks of production
```
