from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comments.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

limiter = Limiter(get_remote_address, app=app, default_limits=["100 per hour"])
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', 'secret123')

# Load bad words from file
with open("bad_words.txt", encoding="utf-8") as f:
    BAD_WORDS = set(line.strip().lower() for line in f if line.strip())

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)

with app.app_context():
    db.create_all()

def contains_bad_words(text):
    return any(bad in text.lower() for bad in BAD_WORDS)

@app.route('/')
def index():
    comments = Comment.query.all()
    return render_template("index.html", comments=comments)

@app.route('/comments', methods=['GET'])
def get_comments():
    comments = Comment.query.all()
    return jsonify([{'id': c.id, 'text': c.text} for c in comments])

@app.route('/comments', methods=['POST'])
@limiter.limit("1 per 5 seconds")
def post_comment():
    data = request.get_json()
    comment_text = data.get('text')
    if not comment_text:
        return jsonify({"error": "Comment text is required"}), 400
    if contains_bad_words(comment_text):
        return jsonify({"error": "Inappropriate content"}), 400
    new_comment = Comment(text=comment_text)
    db.session.add(new_comment)
    db.session.commit()
    return jsonify({"message": "Comment posted successfully"}), 201

@app.route('/comments/<int:id>', methods=['DELETE'])
def delete_comment(id):
    token = request.headers.get('Authorization')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401
    comment = Comment.query.get(id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted successfully"}), 200

@app.route('/admin-verify', methods=['POST'])
def verify_admin():
    token = request.headers.get('Authorization')
    if token != f"Bearer {ADMIN_TOKEN}":
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"message": "OK"}), 200

if __name__ == '__main__':
    app.run(debug=True)
