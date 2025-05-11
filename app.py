import os
from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Create Flask application
app = Flask(__name__)

# Configure SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Initialize rate limiter:
#   - Use Redis if REDIS_URL is set in the environment
#   - Otherwise fall back to in-memory storage
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv('REDIS_URL', 'memory://'),
    default_limits=["100 per hour"],
    app=app
)

# Load admin token from environment
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'secret123')

# Load list of bad words from file
with open("bad_words.txt", encoding="utf-8") as f:
    BAD_WORDS = set(line.strip().lower() for line in f if line.strip())

def contains_bad_words(text: str) -> bool:
    """Check if the text contains any prohibited words."""
    text_lower = text.lower()
    return any(bad in text_lower for bad in BAD_WORDS)

# Define Comment model for SQLAlchemy
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)

# Create database tables if they don't exist
with app.app_context():
    db.create_all()

# Route: render the main page with comments
@app.route('/')
def index():
    comments = Comment.query.order_by(Comment.id.desc()).all()
    return render_template('index.html', comments=comments)

# API: get all comments
@app.route('/comments', methods=['GET'])
def get_comments():
    comments = Comment.query.order_by(Comment.id.desc()).all()
    return jsonify([{'id': c.id, 'text': c.text} for c in comments])

# API: post a new comment (rate-limited)
@app.route('/comments', methods=['POST'])
@limiter.limit("1 per 5 seconds")
def post_comment():
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"error": "Comment text is required"}), 400
    if contains_bad_words(text):
        return jsonify({"error": "Inappropriate content"}), 400
    comment = Comment(text=text)
    db.session.add(comment)
    db.session.commit()
    return jsonify({"message": "Comment posted successfully"}), 201

# API: delete a comment (requires admin token)
@app.route('/comments/<int:id>', methods=['DELETE'])
def delete_comment(id):
    token = request.headers.get('Authorization', '')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401
    comment = Comment.query.get(id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted successfully"}), 200

# API: verify admin token
@app.route('/admin-verify', methods=['POST'])
def verify_admin():
    token = request.headers.get('Authorization', '')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": "OK"}), 200

if __name__ == '__main__':
    # For local development; in production use Gunicorn via Procfile
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
