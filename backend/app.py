"""
app.py – Gradiq Flask Application Entry Point
==============================================
Registers all blueprints and starts the development server.

Usage:
    python app.py
"""

import sys
import os

# Allow imports from the backend root
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes.auth           import auth_bp
from routes.students       import students_bp
from routes.predictions    import predictions_bp
from routes.dashboard      import dashboard_bp
from routes.analytics      import analytics_bp
from routes.student_portal import student_portal_bp
from routes.model_training import model_training_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Allow requests from the Vite dev server and production frontend
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Register blueprints ──────────────────────────────────────────────────
    app.register_blueprint(auth_bp,           url_prefix="/api/auth")
    app.register_blueprint(students_bp,       url_prefix="/api/students")
    app.register_blueprint(predictions_bp,    url_prefix="/api")
    app.register_blueprint(dashboard_bp,      url_prefix="/api")
    app.register_blueprint(analytics_bp,      url_prefix="/api")
    app.register_blueprint(student_portal_bp)
    app.register_blueprint(model_training_bp, url_prefix="/api")

    # ── Health-check ─────────────────────────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "app": "Gradiq"}), 200

    # ── Generic error handlers ────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def request_too_large(e):
        return jsonify({"error": "Request exceeds the 10 MB upload limit."}), 413

    @app.errorhandler(500)
    def internal_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    application = create_app()
    print("=" * 55)
    print(" Gradiq – Student Performance Prediction System")
    print(f" Running on http://localhost:{Config.FLASK_PORT}")
    print(" Press Ctrl+C to stop")
    print("=" * 55)
    application.run(
        host="0.0.0.0",
        port=Config.FLASK_PORT,
        debug=Config.DEBUG
    )
