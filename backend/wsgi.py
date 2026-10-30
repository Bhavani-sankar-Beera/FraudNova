
"""
WSGI entry point for FraudNova AI on Render.
Initializes the database before serving requests.
"""

from app import app, init_db

# Initialize database tables and admin account.
# This does not drop existing tables.
init_db()
