FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Run as an unprivileged user; it only needs to write the local SQLite fallback in instance/
RUN useradd --create-home app && mkdir -p instance && chown app instance
USER app
CMD ["sh", "-c", "exec gunicorn app:app --bind 0.0.0.0:${PORT:-8000}"]
