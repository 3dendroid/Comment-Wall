from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy

# Initialize the app
app = Flask(__name__)

# Setting up the database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///comments.db'  # Local SQLite database
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# Comment model
class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)

# Create tables
with app.app_context():
    db.create_all()

# Endpoints for comments
@app.route('/comments', methods=['GET'])
def get_comments():
    comments = Comment.query.all()
    return jsonify([{'id': c.id, 'text': c.text} for c in comments])

# Endpoints for new comments
@app.route('/comments', methods=['POST'])
def post_comment():
    data = request.get_json()  # Get JSON data
    comment_text = data.get('text')

    if not comment_text:
        return jsonify({"error": "Comment text is required"}), 400

    new_comment = Comment(text=comment_text)  # Create a new comment
    db.session.add(new_comment)  # ADd it to the database
    db.session.commit()  # Confirm changes

    return jsonify({"message": "Comment posted successfully"}), 201

# Endpoints for deleting comments
@app.route('/comments/<int:id>', methods=['DELETE'])
def delete_comment(id):
    comment = Comment.query.get(id)
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    db.session.delete(comment)
    db.session.commit()

    return jsonify({"message": "Comment deleted successfully"}), 200

# Run the app
if __name__ == '__main__':
    app.run(debug=True)