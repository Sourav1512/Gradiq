"""
config.py – Centralised configuration loaded from environment variables.
Copy .env.example to .env and fill in your MySQL credentials.
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask application settings
    SECRET_KEY   = os.getenv("SECRET_KEY", "gradiq_super_secure_jwt_secret_key_2025_32bytes_minimum")
    FLASK_PORT   = int(os.getenv("FLASK_PORT", 5000))
    DEBUG        = os.getenv("FLASK_ENV", "development") == "development"

    # MySQL Database connection parameters from environment variables
    DB_HOST      = os.getenv("DB_HOST", "localhost")
    DB_PORT      = int(os.getenv("DB_PORT", 3306))
    DB_USER      = os.getenv("DB_USER", "root")
    DB_PASSWORD  = os.getenv("DB_PASSWORD", "")
    DB_NAME      = os.getenv("DB_NAME", "gradiq_db")
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024
