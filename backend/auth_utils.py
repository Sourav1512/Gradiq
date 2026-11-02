"""
auth_utils.py – Authentication and Role-Based Authorization Helpers for Gradiq.
Uses PyJWT with HS256 for secure, stateless token authentication.
"""

import os
import datetime
import jwt
from functools import wraps
from flask import request, jsonify, g
from config import Config
from database import get_db_connection

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7


def generate_token(user: dict) -> str:
    """Generate a signed JWT token containing user id, email, and role."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + datetime.timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a signed JWT token. Raises exceptions on failure."""
    return jwt.decode(token, Config.SECRET_KEY, algorithms=[JWT_ALGORITHM])


def get_token_from_header() -> str:
    """Extract Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.split(" ", 1)[1].strip()
    return ""


def token_required(f):
    """Decorator to require a valid JWT token on an endpoint."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_header()
        if not token:
            return jsonify({"error": "Authentication token is missing. Please log in."}), 401

        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authentication token. Please log in again."}), 401

        # Verify user still exists in database
        conn = cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT id, full_name, email, role FROM users WHERE id = %s",
                (payload["id"],)
            )
            user = cursor.fetchone()
            if not user:
                return jsonify({"error": "User account no longer exists."}), 401

            # Attach verified user to Flask context
            g.current_user = user
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 500
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator to require the authenticated user to be an admin."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.get("role") != "admin":
            return jsonify({"error": "Access denied: Administrator privileges required."}), 403
        return f(*args, **kwargs)
    return decorated


def student_required(f):
    """Decorator to require the authenticated user to be a student."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.get("role") != "student":
            return jsonify({"error": "Access denied: Student access only."}), 403
        return f(*args, **kwargs)
    return decorated

