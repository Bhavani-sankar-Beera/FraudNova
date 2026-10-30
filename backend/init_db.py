
#!/usr/bin/env python
"""
Database initialization script for FraudNova AI.
Creates tables and populates demo data when the database is empty.
"""

import os
import sys

# Add backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User, Transaction
from auth import hash_password


def init_database():
    """Initialize database tables, admin account, and demo transactions."""

    print("Initializing FraudNova AI database...")

    with app.app_context():
        # Create tables without deleting existing data
        db.create_all()
        print("[OK] Database tables created or already exist.")

        # Use demo credentials locally; environment variables can override them.
        admin_username = os.environ.get("ADMIN_USERNAME", "admin")
        admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
        admin_email = os.environ.get(
            "ADMIN_EMAIL", "admin@fraudnova.ai"
        )

        # Create admin only if credentials are configured
        admin = User.query.filter_by(
            username=admin_username
        ).first()

        if admin:
            print(f"[OK] Admin user already exists: {admin_username}")

        else:
            admin = User(
                username=admin_username,
                email=admin_email,
                full_name="System Administrator",
                password_hash=hash_password(admin_password),
                role="admin"
            )

            db.session.add(admin)
            db.session.commit()
            print(f"[OK] Admin user created: {admin_username}")

        # Insert demo transactions only if the database is empty
        existing_count = Transaction.query.count()

        if existing_count == 0:
            demo_txns = [
                {
                    "transaction_id": "TXN1001",
                    "customer_id": "CUST1001",
                    "amount": 2500,
                    "transaction_time": "2026-08-01 10:30",
                    "merchant_category": "Electronics",
                    "payment_method": "Credit Card",
                    "location": "Mumbai",
                    "device_type": "Known Device",
                    "transaction_frequency": 1,
                    "average_spending": 2000,
                    "previous_transaction_amount": 1200,
                    "distance_from_previous_location": 5,
                    "prediction": "Not Fraud",
                    "risk_score": 5,
                    "confidence": 0.95
                },
                {
                    "transaction_id": "TXN1002",
                    "customer_id": "CUST1002",
                    "amount": 85000,
                    "transaction_time": "2026-08-01 10:31",
                    "merchant_category": "Electronics",
                    "payment_method": "Credit Card",
                    "location": "Delhi",
                    "device_type": "New Device",
                    "transaction_frequency": 2,
                    "average_spending": 15000,
                    "previous_transaction_amount": 1200,
                    "distance_from_previous_location": 850,
                    "prediction": "Fraud",
                    "risk_score": 94,
                    "confidence": 0.945
                },
                {
                    "transaction_id": "TXN1003",
                    "customer_id": "CUST1003",
                    "amount": 1200,
                    "transaction_time": "2026-08-01 10:32",
                    "merchant_category": "Grocery",
                    "payment_method": "Debit Card",
                    "location": "Mumbai",
                    "device_type": "Known Device",
                    "transaction_frequency": 3,
                    "average_spending": 1500,
                    "previous_transaction_amount": 800,
                    "distance_from_previous_location": 2,
                    "prediction": "Not Fraud",
                    "risk_score": 8,
                    "confidence": 0.92
                }
            ]

            for txn_data in demo_txns:
                txn = Transaction(**txn_data)
                db.session.add(txn)

            db.session.commit()
            print(
                f"[OK] Inserted {len(demo_txns)} demo transactions."
            )

        else:
            print(
                f"[OK] Database already contains "
                f"{existing_count} transactions."
            )

        print("[OK] Database initialization complete.")


if __name__ == "__main__":
    init_database()
