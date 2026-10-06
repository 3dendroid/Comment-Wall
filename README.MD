# Anonymous Comment Wall

A small Flask app for posting anonymous comments.

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
├── Procfile          # Railway deployment
├── Dockerfile        # container image
└── .dockerignore
```

## Run with Docker / Podman

```bash
podman build -t comment-wall:v1 .
podman run -d --name comment-wall -p 8080:8000 comment-wall:v1
```

Open http://localhost:8080

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | SQLite in `instance/` |
| `ADMIN_TOKEN` | token for admin mode | — |