"""
WSGI entry point for FraudNova AI on Render.
"""

from app import app, init_db

# Initialize database tables and the configured admin account.
init_db()
