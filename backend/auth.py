from datetime import datetime, timedelta
import os
import secrets
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
from models import db, User

JWT_SECRET = os.environ.get('JWT_SECRET_KEY') or secrets.token_hex(32)
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24


def hash_password(password):
    """Hash a password using werkzeug security."""
    return generate_password_hash(password, method='pbkdf2:sha256')


def verify_password(password_hash, password):
    """Verify a password against its hash."""
    return check_password_hash(password_hash, password)


def generate_jwt_token(user):
    """Generate a JWT token for an authenticated user."""
    payload = {
        'sub': str(user.id),
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token):
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def register_user(username=None, email=None, password=None, full_name=None, role='analyst'):
    """Register a new user in the database."""
    email = (email or '').strip().lower()
    full_name = (full_name or '').strip()
    username = (username or '').strip().lower()

    if not email or '@' not in email:
        return None, "A valid email address is required."

    # If username is omitted, derive a unique one from email
    if not username:
        import re
        base = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
        candidate = base
        counter = 1
        while User.query.filter_by(username=candidate).first():
            candidate = f"{base}{counter}"
            counter += 1
        username = candidate

    if len(username) < 3:
        return None, "Username must be at least 3 characters."
    if not password or len(password) < 6:
        return None, "Password must be at least 6 characters."

    # Check if username already exists
    if User.query.filter_by(username=username).first():
        return None, f"Username '{username}' is already taken."

    # Check if email already exists
    if User.query.filter_by(email=email).first():
        return None, f"Email '{email}' is already registered."

    valid_roles = ['analyst', 'investigator', 'admin', 'risk_officer']
    if role not in valid_roles:
        role = 'analyst'

    new_user = User(
        username=username,
        email=email,
        full_name=full_name or username,
        password_hash=hash_password(password),
        role=role
    )

    db.session.add(new_user)
    db.session.commit()
    return new_user, None



def create_or_get_admin_user():
    """Create the local demo admin, allowing credentials to be overridden."""
    admin_username = os.environ.get("ADMIN_USERNAME", "admin")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fraudnova.ai")

    admin = User.query.filter_by(username=admin_username).first()
    if admin:
        return admin

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
    return admin



def authenticate_user(username, password):
    """Authenticate user by username OR email and password."""
    identifier = (username or '').strip().lower()
    user = User.query.filter((User.username == identifier) | (User.email == identifier)).first()
    if user and verify_password(user.password_hash, password):
        return user
    return None