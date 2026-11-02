"""
database.py – MySQL connection helper.

Connects to MySQL using environment variables defined in Config.
Uses a connection-per-request pattern suitable for a college project.
"""
import mysql.connector
from config import Config


def get_db_connection():
    """Return a new MySQL connection using environment variables loaded in Config."""
    conn = mysql.connector.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        autocommit=False
    )
    return conn
