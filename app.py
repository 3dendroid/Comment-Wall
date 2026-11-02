import hmac
import os
import re
from datetime import datetime, timezone

from flask import Flask, request, jsonify, render_template
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text as sql_text
from werkzeug.middleware.proxy_fix import ProxyFix

# Create Flask application
app = Flask(__name__)

# Railway (and a k8s ingress) put one reverse proxy in front of the app. Without
# this every request looks like it comes from the proxy's IP, so all visitors
# would share a single rate limit. Trust exactly one X-Forwarded-For hop.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1)

# Configure database URI: use PostgreSQL on Railway if available, else fallback to SQLite locally
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///comments.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# Initialize rate limiter: 100 requests per hour by default; routes below override it
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("REDIS_URL", "memory://"),
    default_limits=["100 per hour"],
    app=app,
)

# Admin token for protected delete operations.
# No fallback value on purpose: shipping a known default in a public repo would
# mean anyone could pass it. If the variable is not set, admin access is disabled.
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

MAX_LENGTH = 500  # matches the Comment.text column size
PAGE_MAX = 100  # largest page the API returns when ?limit= is used


def is_admin(req) -> bool:
    """True only if an admin token is configured AND the request carries it.
    The `not ADMIN_TOKEN` guard runs before any string comparison, so when the
    token is unset the expected value never becomes "Bearer None" (which an
    attacker could otherwise send and match). compare_digest takes the same
    time whatever the input, so the token can't be guessed by timing."""
    if not ADMIN_TOKEN:
        return False
    sent = req.headers.get("Authorization", "")
    return hmac.compare_digest(sent.encode(), f"Bearer {ADMIN_TOKEN}".encode())


# Only failed admin attempts count, so brute-forcing the token is slow
# while a real admin can still delete many comments in a row.
admin_limit = limiter.limit(
    "10 per minute", deduct_when=lambda response: response.status_code == 401
)


# Load list of prohibited words from file
with open("bad_words.txt", encoding="utf-8") as f:
    BAD_LIST = [line.strip().lower() for line in f if line.strip()]

# Compile a regex to match any bad word as a whole word (case-insensitive)
BAD_RE = re.compile(
    r"\b(?:" + "|".join(map(re.escape, BAD_LIST)) + r")\b", flags=re.IGNORECASE
)

# "f u c k" / "f.u.c.k" -> "fuck": single letters joined by spaces or punctuation
SPACED_RE = re.compile(r"\b\w(?:[\s.\-_*]+\w\b){2,}")
# "fuuuck" -> "fuck" / "fuuck": runs of 3+ identical letters
REPEAT_RE = re.compile(r"(\w)\1{2,}")


def contains_bad_words(text: str) -> bool:
    """Return True if the text contains any prohibited word as a standalone word,
    also after undoing the common spacing and letter-stretching tricks."""
    joined = SPACED_RE.sub(lambda m: re.sub(r"[\s.\-_*]", "", m.group()), text)
    variants = {
        text,
        joined,
        REPEAT_RE.sub(r"\1", joined),
        REPEAT_RE.sub(r"\1\1", joined),
    }
    return any(BAD_RE.search(v) for v in variants)


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


# Define the Comment model for storing comments
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(MAX_LENGTH), nullable=False)
    created_at = db.Column(db.DateTime, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            # stored as naive UTC; older rows have no timestamp
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


# Create database tables if they don't exist, and add the created_at column to
# a table made by an older version (create_all never alters existing tables).
with app.app_context():
    db.create_all()
    columns = {c["name"] for c in inspect(db.engine).get_columns("comment")}
    if "created_at" not in columns:
        with db.engine.begin() as conn:
            conn.execute(sql_text("ALTER TABLE comment ADD COLUMN created_at TIMESTAMP"))


# Everything the page needs comes from this site, so the browser may load nothing
# else: an injected <script> or inline handler would be refused even if a bug let
# one through. The page has no inline scripts, styles or event attributes.
CONTENT_SECURITY_POLICY = "; ".join([
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@app.after_request
def set_security_headers(response):
    response.headers["Content-Security-Policy"] = CONTENT_SECURITY_POLICY
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


def latest_comments(limit=None, before=None):
    query = Comment.query.order_by(Comment.id.desc())
    if before is not None:
        query = query.filter(Comment.id < before)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@app.route("/")
def index():
    """Render the main page showing the newest comments."""
    return render_template("index.html", comments=latest_comments(limit=50))


@app.route("/comments", methods=["GET"])
# The page polls this every 5 seconds (12 per minute); leave room for a few tabs.
@limiter.limit("60 per minute")
def get_comments():
    """Return comments as JSON, newest first.
    Without parameters returns all of them; ?limit=N (1-100) returns one page,
    and ?before=ID continues from the oldest comment of the previous page."""
    limit = request.args.get("limit", type=int)
    before = request.args.get("before", type=int)
    if limit is not None and not 1 <= limit <= PAGE_MAX:
        return jsonify({"error": f"limit must be between 1 and {PAGE_MAX}"}), 400
    if before is not None and limit is None:
        limit = PAGE_MAX
    return jsonify([c.to_dict() for c in latest_comments(limit, before)])


@app.route("/comments", methods=["POST"])
@limiter.limit("1 per 5 seconds")
def post_comment():
    """Accept a new comment; reject empty or inappropriate content.
    Returns the newly created comment as JSON."""
    data = request.get_json(silent=True)
    text = data.get("text", "") if isinstance(data, dict) else ""
    if not isinstance(text, str):
        return jsonify({"error": "Comment text must be a string"}), 400
    text = text.strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400
    if len(text) > MAX_LENGTH:
        return jsonify({"error": f"Comment is longer than {MAX_LENGTH} characters"}), 400
    if contains_bad_words(text):
        return jsonify({"error": "Inappropriate content"}), 400

    comment = Comment(text=text)
    db.session.add(comment)
    db.session.commit()
    return jsonify(comment.to_dict()), 201


@app.route("/comments/<int:id>", methods=["DELETE"])
@admin_limit
def delete_comment(id):
    """Delete a comment by ID, protected by admin token."""
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401

    comment = db.session.get(Comment, id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200


@app.route("/admin-verify", methods=["POST"])
@admin_limit
def verify_admin():
    """Verify the admin token without performing any action. Returns OK if the token matches."""
    if not is_admin(request):
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": "OK"}), 200


if __name__ == "__main__":
    # Local development: listen on the port defined by environment or default 20000
    port = int(os.environ.get("PORT", 20000))
    app.run(host="0.0.0.0", port=port)
