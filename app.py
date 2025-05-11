import os
import re

from flask import Flask, request, jsonify, render_template
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_sqlalchemy import SQLAlchemy

# Create Flask application
app = Flask(__name__)

# Configure database URI: use PostgreSQL on Railway if available, else fallback to SQLite locally
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    'sqlite:///comments.db'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Initialize rate limiter: limit POSTs to 1 per 5 seconds, 100 GETs per hour
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv('REDIS_URL', 'memory://'),
    default_limits=["100 per hour"],
    app=app
)

# Admin token for protected delete operations
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'secret123')

# Load list of prohibited words from file
with open("bad_words.txt", encoding="utf-8") as f:
    BAD_LIST = [line.strip().lower() for line in f if line.strip()]

# Compile a regex to match any bad word as a whole word (case-insensitive)
BAD_RE = re.compile(
    r"\b(?:" + "|".join(map(re.escape, BAD_LIST)) + r")\b",
    flags=re.IGNORECASE
)

def contains_bad_words(text: str) -> bool:
    """Return True if the text contains any prohibited word as a standalone word."""
    return bool(BAD_RE.search(text))

# Define the Comment model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)

# Create database tables if they don't exist
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    """Render the main page showing all comments."""
    comments = Comment.query.order_by(Comment.id.desc()).all()
    return render_template('index.html', comments=comments)

@app.route('/comments', methods=['GET'])
def get_comments():
    """Return all comments as JSON."""
    comments = Comment.query.order_by(Comment.id.desc()).all()
    return jsonify([{'id': c.id, 'text': c.text} for c in comments])

@app.route('/comments', methods=['POST'])
@limiter.limit("1 per 5 seconds")
def post_comment():
    """Accept a new comment; reject empty or inappropriate content.
    Returns the newly created comment as JSON."""
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400
    if contains_bad_words(text):
        return jsonify({"error": "Inappropriate content"}), 400

    comment = Comment(text=text)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"id": comment.id, "text": comment.text}), 201

@app.route('/comments/<int:id>', methods=['DELETE'])
def delete_comment(id):
    """Delete a comment by ID, protected by admin token."""
    token = request.headers.get('Authorization', '')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401

    comment = Comment.query.get(id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Deleted"}), 200

@app.route('/admin-verify', methods=['POST'])
def verify_admin():
    """Verify the admin token without performing any action. Returns OK if the token matches."""
    token = request.headers.get('Authorization', '')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": "OK"}), 200

if __name__ == '__main__':
    # Local development: listen on the port defined by environment or default 5000
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
