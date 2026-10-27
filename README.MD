# Anonymous Comment Wall

![Playwright Tests](https://github.com/3dendroid/Comment-Wall/actions/workflows/playwright.yml/badge.svg)

A small Flask app for posting anonymous comments.

Live: https://commentwall.up.railway.app/

Features: bad-words filter, rate limiting, admin mode for deleting comments.
Storage: PostgreSQL in production, SQLite fallback for local runs.

## Project structure

```
comment-wall/
├── app.py
├── templates/
│   └── index.html
├── bad_words.txt
├── requirements.txt
├── Procfile               # Railway deployment
├── Dockerfile             # container image
├── .dockerignore
├── e2e/                   # Playwright tests
│   ├── pages/
│   │   └── CommentWallPage.ts  # Page Object
│   ├── fixtures.ts             # custom fixture "wall"
│   ├── commentwall.spec.ts     # UI tests + UI vs API check
│   ├── buttons.spec.ts         # button tests
│   ├── api.spec.ts             # negative API tests
│   └── db.spec.ts              # API vs database check
├── playwright.config.ts
├── tsconfig.json
├── package.json
└── .github/workflows/
    └── playwright.yml     # CI
```

## Run with Docker / Podman

```bash
podman build -t comment-wall:v1 .
podman run -d --name comment-wall -p 8080:8000 comment-wall:v1
```

Open http://localhost:8080

## Configuration

| Variable       | Purpose                      | Default               |
| -------------- | ---------------------------- | --------------------- |
| `DATABASE_URL` | PostgreSQL connection string | SQLite in `instance/` |
| `ADMIN_TOKEN`  | token for admin mode         | —                     |

## Tests

End-to-end tests with **Playwright + TypeScript**. They run against the live app on Railway.

UI tests use the **Page Object Model** (`e2e/pages/`) and a **custom fixture** `wall` (`e2e/fixtures.ts`). The fixture creates the page object and opens the page before the test.

| File                  | What it checks                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `commentwall.spec.ts` | page title, placeholder in the comment input, number of comments on the page = number in the API   |
| `buttons.spec.ts`     | Submit, Admin Mode and theme buttons are visible; the theme button changes its label after a click |
| `api.spec.ts`         | `DELETE` without token → 401, `POST` with empty text → 400                                         |
| `db.spec.ts`          | number of comments in the API = number of rows in PostgreSQL                                       |

### Run locally

```bash
npm ci
npx playwright install chromium
npx playwright test
npx playwright show-report
```

`db.spec.ts` needs `DATABASE_URL`. Put it in a `.env` file in the project root. `.env` is in `.gitignore` and `.dockerignore`, so it is never committed or copied into the image.

### CI

GitHub Actions runs the tests on every pull request and push to `main`.
In CI, `DATABASE_URL` comes from an encrypted repository secret.
`main` is protected: a pull request can't be merged until the tests pass.