from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
from flask_session import Session
from datetime import datetime, timedelta
from functools import wraps
from io import BytesIO
import os
import secrets
import sys

# Import models and database
from models import db, User, Transaction, ShapExplanation
from auth import (
    authenticate_user, 
    hash_password, 
    create_or_get_admin_user,
    generate_jwt_token,
    verify_jwt_token,
    register_user
)
from database import SQLALCHEMY_DATABASE_URI, SQLALCHEMY_TRACK_MODIFICATIONS
from ml_service import ml_service
from bulk_analysis import (
    MAX_RECORDS,
    csv_bytes,
    excel_bytes,
    new_batch_id,
    preview_rows,
    read_upload,
    template_bytes,
    validate_frame,
)

# Initialize Flask app
app = Flask(__name__)
bulk_batches = {}

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

# Session configuration - CRITICAL for cookies to work
app.config['SECRET_KEY'] = os.environ.get('SESSION_SECRET_KEY') or secrets.token_hex(32)
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_FILE_DIR'] = os.path.join(os.path.dirname(__file__), 'flask_sessions')
app.config['SESSION_PERMANENT'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SECURE'] = False  # False for localhost (http)
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_NAME'] = 'fraudnova_session'

# Ensure session directory exists
os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)

# Initialize session
Session(app)

# Initialize database
db.init_app(app)

# Enable CORS with credentials support - allow multiple ports for dev
CORS(app, supports_credentials=True, resources={r"/api/*": {
    "origins": [
        "http://localhost:5173", 
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    ], 
    "supports_credentials": True,
    "allow_headers": ["Content-Type", "Authorization"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}})


# ==================== Authentication Helpers ====================

def get_token_from_header():
    """Extract Bearer token from Authorization header."""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header.split(' ', 1)[1].strip()
    return None


def get_current_user():
    """Get currently logged-in user from JWT Bearer token."""
    token = get_token_from_header()
    if token:
        payload = verify_jwt_token(token)
        if payload and 'user_id' in payload:
            return User.query.get(payload['user_id'])
    return None


def login_required(f):
    """Decorator to check if user is authenticated via JWT Bearer token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'success': False, 'message': 'Authentication required. Please log in.'}), 401
        request.current_user = user
        return f(*args, **kwargs)
    return decorated_function


# ==================== Helper Functions ====================

def _make_pipeline():
    """Generate processing pipeline for visualization."""
    steps = [
        "Preprocessing",
        "Feature Engineering",
        "CNN + LSTM",
        "Feature Extraction",
        "QSVM",
        "Prediction",
    ]
    return [{"name": s, "status": "completed"} for s in steps]


def _calculate_risk_score(amount, tx_freq, avg_spending, distance):
    """Calculate risk score from transaction features."""
    risk = min(99, int((amount / max(1, avg_spending)) * 30 + (tx_freq * 5) + (distance / 100)))
    return max(0, risk)


def _generate_explanation(shap_values, prediction):
    """Generate text explanation from SHAP values."""
    if prediction == 'Fraud':
        return "The transaction was classified as high risk mainly because the transaction amount is significantly higher than the customer's average spending. The use of a new device and large location change also contributed to the fraud prediction."
    else:
        return "The transaction pattern matches the customer's historical behavior. The amount is reasonable for this customer, and the location is familiar."


def _transaction_model_input(txn):
    """Convert a stored transaction into the model's prediction input shape."""
    return {
        "transaction_id": txn.transaction_id,
        "customer_id": txn.customer_id,
        "amount": txn.amount,
        "transaction_time": txn.transaction_time,
        "merchant_category": txn.merchant_category,
        "payment_method": txn.payment_method,
        "location": txn.location,
        "device_type": txn.device_type,
        "transaction_frequency": txn.transaction_frequency,
        "average_spending": txn.average_spending,
        "previous_transaction_amount": txn.previous_transaction_amount,
        "distance_from_previous_location": txn.distance_from_previous_location,
    }


def _bulk_prediction(record):
    """Run the existing model pipeline for one bulk record."""
    if not ml_service.is_loaded:
        raise RuntimeError(f"Trained model is unavailable: {ml_service.load_error}")
    # SHAP KernelExplainer is intentionally reserved for single-transaction
    # analysis; calculating it for every uploaded row makes bulk analysis
    # disproportionately slow without changing the prediction.
    result = ml_service.predict_transaction(record, include_shap=False)
    return {
        "prediction": result["prediction"],
        "risk_score": result["risk_score"],
        "confidence": result.get("confidence"),
        "shap": result["shap"],
        "shap_metadata": result.get("shap_metadata"),
        "explanation": result["explanation"],
        "mode": result.get("mode", "ML_QUANTUM_HYBRID"),
    }


# ==================== Authentication Routes ====================

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "FraudNova AI Backend",
        "ml_loaded": ml_service.is_loaded,
        "ml_error": ml_service.load_error,
        "model_version": "2.4.0-colab" if ml_service.is_loaded else "demo"
    })


@app.route('/api/model/status', methods=['GET'])
@login_required
def model_status():
    """Return the load state and compatibility error for saved artifacts."""
    return jsonify({
        "success": True,
        "loaded": ml_service.is_loaded,
        "error": ml_service.load_error,
        "info": ml_service.get_model_info(),
    }), 200


@app.route('/api/bulk/template', methods=['GET'])
@login_required
def bulk_template():
    return send_file(
        BytesIO(template_bytes()),
        as_attachment=True,
        download_name="fraudnova_bulk_template.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.route('/api/bulk/analyze', methods=['POST'])
@login_required
def bulk_analyze():
    upload = request.files.get("file")
    if not upload:
        return jsonify({"success": False, "message": "Please upload a CSV or Excel file."}), 400
    if not ml_service.is_loaded:
        return jsonify({
            "success": False,
            "message": "Trained model artifacts are unavailable. Bulk prediction was not generated.",
            "model_error": ml_service.load_error,
        }), 503

    try:
        frame, filename, file_size = read_upload(upload)
        validation = validate_frame(frame)
    except ValueError as exc:
        return jsonify({"success": False, "message": str(exc)}), 400

    if validation["missing_columns"]:
        return jsonify({
            "success": False,
            "message": "Required columns are missing.",
            "missing_columns": validation["missing_columns"],
            "total_records": len(frame),
            "preview": preview_rows(frame),
        }), 422

    results = []
    for record in validation["valid_rows"]:
        try:
            prediction = _bulk_prediction(record)
            results.append({
                **record,
                "prediction": prediction["prediction"],
                "risk_score": prediction["risk_score"],
                "confidence": prediction["confidence"],
                "shap": prediction["shap"],
                "shap_metadata": prediction["shap_metadata"],
                "explanation": prediction["explanation"],
                "mode": prediction["mode"],
                "status": "processed",
            })
        except Exception as exc:
            results.append({
                **record,
                "prediction": "Invalid",
                "risk_score": None,
                "confidence": None,
                "shap": [],
                "shap_metadata": None,
                "explanation": f"Prediction failed: {exc}",
                "mode": "ERROR",
                "status": "failed",
            })

    batch_id = new_batch_id()
    bulk_batches[batch_id] = {
        "filename": filename,
        "file_size": file_size,
        "created_at": datetime.utcnow().isoformat(),
        "results": results,
        "validation_errors": validation["errors"],
    }
    fraud_count = sum(row["prediction"] == "Fraud" for row in results)
    genuine_count = sum(row["prediction"] == "Genuine" for row in results)
    return jsonify({
        "success": True,
        "batch_id": batch_id,
        "filename": filename,
        "total_records": len(frame),
        "valid_records": len(validation["valid_rows"]),
        "invalid_records": len(validation["errors"]) + sum(
            row["status"] == "failed" for row in results
        ),
        "duplicate_records": validation["duplicate_records"],
        "fraud_count": fraud_count,
        "genuine_count": genuine_count,
        "detection_rate": round((fraud_count / len(results)) * 100, 2) if results else 0,
        "validation_errors": validation["errors"],
        "preview": preview_rows(frame),
        "results": results,
        "model_mode": "trained" if ml_service.is_loaded else "unavailable",
    }), 200


@app.route('/api/bulk/<batch_id>', methods=['GET'])
@login_required
def bulk_results(batch_id):
    batch = bulk_batches.get(batch_id)
    if not batch:
        return jsonify({"success": False, "message": "Bulk analysis batch not found."}), 404
    results = batch["results"]
    fraud_count = sum(row["prediction"] == "Fraud" for row in results)
    return jsonify({
        "success": True,
        "batch_id": batch_id,
        "filename": batch["filename"],
        "total_records": len(results),
        "fraud_count": fraud_count,
        "genuine_count": sum(row["prediction"] == "Genuine" for row in results),
        "invalid_records": sum(row["prediction"] == "Invalid" for row in results),
        "results": results,
        "validation_errors": batch["validation_errors"],
    }), 200


@app.route('/api/bulk/<batch_id>/transactions/<transaction_id>/shap', methods=['GET'])
@login_required
def bulk_transaction_shap(batch_id, transaction_id):
    batch = bulk_batches.get(batch_id)
    if not batch:
        return jsonify({"success": False, "message": "Bulk analysis batch not found."}), 404
    result = next(
        (row for row in batch["results"] if str(row.get("transaction_id")) == transaction_id),
        None,
    )
    if not result:
        return jsonify({"success": False, "message": "Transaction not found in batch."}), 404
    if not result.get("shap"):
        if not ml_service.is_loaded:
            return jsonify({
                "success": False,
                "message": "SHAP explanation is unavailable because the trained model is not loaded.",
            }), 503
        try:
            explanation_result = ml_service.predict_transaction(result, include_shap=True)
            result["shap"] = explanation_result["shap"]
            result["shap_metadata"] = explanation_result.get("shap_metadata")
            result["explanation"] = explanation_result["explanation"]
        except Exception as exc:
            app.logger.exception("Bulk SHAP explanation failed")
            return jsonify({
                "success": False,
                "message": "SHAP explanation could not be generated for this transaction.",
                "model_error": str(exc),
            }), 503
    return jsonify({
        "success": True,
        "transaction_id": transaction_id,
        "prediction": result["prediction"],
        "risk_score": result["risk_score"],
        "shap": result["shap"],
        "shap_metadata": result.get("shap_metadata"),
        "explanation": result["explanation"],
    }), 200


@app.route('/api/bulk/<batch_id>/export', methods=['GET'])
@login_required
def bulk_export(batch_id):
    batch = bulk_batches.get(batch_id)
    if not batch:
        return jsonify({"success": False, "message": "Bulk analysis batch not found."}), 404
    export_format = request.args.get("format", "csv").lower()
    rows = [
        {key: value for key, value in row.items() if key != "shap"}
        for row in batch["results"]
    ]
    if export_format == "xlsx":
        return send_file(
            BytesIO(excel_bytes(rows)),
            as_attachment=True,
            download_name=f"{batch_id}_results.xlsx",
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    if export_format == "csv":
        return send_file(
            BytesIO(csv_bytes(rows)),
            as_attachment=True,
            download_name=f"{batch_id}_results.csv",
            mimetype="text/csv",
        )
    return jsonify({"success": False, "message": "format must be csv or xlsx"}), 400


@app.route('/api/bulk/<batch_id>/validation-report', methods=['GET'])
@login_required
def bulk_validation_report(batch_id):
    batch = bulk_batches.get(batch_id)
    if not batch:
        return jsonify({"success": False, "message": "Bulk analysis batch not found."}), 404
    return send_file(
        BytesIO(csv_bytes(batch["validation_errors"])),
        as_attachment=True,
        download_name=f"{batch_id}_validation_errors.csv",
        mimetype="text/csv",
    )


@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user account and return JWT token."""
    data = request.get_json() or {}
    email = data.get('email') or data.get('mail')
    full_name = data.get('full_name') or data.get('name')
    password = data.get('password') or data.get('pass')
    username = data.get('username')
    role = data.get('role', 'analyst')
    
    user, error_msg = register_user(username=username, email=email, password=password, full_name=full_name, role=role)
    if error_msg:
        return jsonify({'success': False, 'message': error_msg}), 400
    
    # Generate JWT token for immediate access
    token = generate_jwt_token(user)
    
    return jsonify({
        'success': True,
        'message': 'Account created successfully.',
        'token': token,
        'user': user.to_dict()
    }), 201


@app.route('/api/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token."""
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password required'}), 400
    
    user = authenticate_user(username, password)
    if not user:
        return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    
    # Generate JWT token
    token = generate_jwt_token(user)
    
    return jsonify({
        'success': True,
        'token': token,
        'user': user.to_dict()
    }), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    """Log out the current user."""
    return jsonify({'success': True, 'message': 'Logged out successfully'}), 200


@app.route('/api/me', methods=['GET'])
@login_required
def get_me():
    """Get current user information."""
    user = request.current_user
    return jsonify({
        'success': True,
        'user': user.to_dict()
    }), 200


# ==================== Prediction Route ====================

@app.route('/api/predict', methods=['POST'])
@login_required
def predict():
    """Analyze transaction and return prediction with SHAP."""
    data = request.get_json() or {}
    
    # Coerce numeric fields
    def to_num(v):
        try:
            return int(v)
        except Exception:
            try:
                return float(v)
            except Exception:
                return 0
    
    amount = to_num(data.get('amount') if data.get('amount') is not None else data.get('amount_inr'))
    tx_freq = to_num(data.get('transaction_frequency'))
    avg = to_num(data.get('average_spending') if data.get('average_spending') is not None else data.get('average_spending_inr'))
    prev = to_num(data.get('previous_transaction_amount') if data.get('previous_transaction_amount') is not None else data.get('previous_transaction_amount_inr'))
    dist = to_num(data.get('distance_from_previous_location') if data.get('distance_from_previous_location') is not None else data.get('distance_from_previous_location_km'))
    
    # Check if transaction_id already exists
    existing = Transaction.query.filter_by(transaction_id=data.get('transaction_id')).first()
    if existing:
        return jsonify({'success': False, 'message': f'Transaction {data.get("transaction_id")} already exists'}), 400
    
    if not ml_service.is_loaded:
        return jsonify({
            'success': False,
            'message': 'Trained model artifacts are unavailable. Prediction was not generated.',
            'model_error': ml_service.load_error,
        }), 503

    try:
        ml_res = ml_service.predict_transaction(data)
    except Exception as exc:
        app.logger.exception("Model prediction failed")
        return jsonify({
            'success': False,
            'message': 'Model prediction failed. No fallback prediction was generated.',
            'model_error': str(exc),
        }), 503

    prediction = ml_res['prediction']
    risk_score = ml_res['risk_score']
    confidence = ml_res['confidence']
    mode = ml_res.get('mode', 'ML_QUANTUM_HYBRID')
    pipeline = ml_res.get('pipeline', _make_pipeline())
    shap_vals = ml_res.get('shap', [])
    explanation = ml_res.get('explanation', '')
    
    time_val = data.get('time') or data.get('transaction_time') or datetime.utcnow().strftime('%H:%M')
    merchant_val = data.get('merchant_category') or data.get('merchant') or 'General'
    location_val = data.get('location') or 'Standard'
    device_val = data.get('device_type') or data.get('device') or 'Standard'

    # Create transaction record
    txn = Transaction(
        transaction_id=data.get('transaction_id') or f"TXN{int(datetime.utcnow().timestamp())}",
        customer_id=data.get('customer_id') or 'CUST_UNKNOWN',
        amount=amount,
        transaction_time=time_val,
        merchant_category=merchant_val,
        payment_method=data.get('payment_method') or 'Credit Card',
        location=location_val,
        device_type=device_val,
        transaction_frequency=tx_freq,
        average_spending=avg,
        previous_transaction_amount=prev,
        distance_from_previous_location=dist,
        prediction=prediction,
        risk_score=risk_score,
        confidence=confidence
    )
    
    db.session.add(txn)
    db.session.commit()
    
    # Save SHAP values
    for shap_val in shap_vals:
        shap_exp = ShapExplanation(
            transaction_id=txn.transaction_id,
            feature_name=shap_val.get('feature'),
            feature_value=str(shap_val.get('value')),
            shap_value=shap_val.get('impact')
        )
        db.session.add(shap_exp)
    
    db.session.commit()
    
    pred_class = 1 if prediction == 'Fraud' else 0
    risk_level = 'High' if risk_score >= 75 else ('Medium' if risk_score >= 40 else 'Low')
    status = f"{risk_level} Risk"

    return jsonify({
        'success': True,
        'transaction_id': txn.transaction_id,
        'customer_id': txn.customer_id,
        'prediction': prediction,
        'class': pred_class,
        'risk': risk_level,
        'risk_level': risk_level,
        'status': status,
        'risk_score': risk_score,
        'confidence': confidence,
        'amount': txn.amount,
        'merchant': txn.merchant_category,
        'merchant_category': txn.merchant_category,
        'location': txn.location,
        'time': txn.transaction_time,
        'transaction_time': txn.transaction_time,
        'device': txn.device_type,
        'device_type': txn.device_type,
        'mode': mode,
        'pipeline': pipeline,
        'shap': shap_vals,
        'shap_metadata': ml_res.get('shap_metadata'),
        'explanation': explanation
    }), 201


# ==================== Dashboard Route ====================

@app.route('/api/dashboard', methods=['GET'])
@login_required
def dashboard():
    """Get dashboard statistics from database."""
    total = Transaction.query.count()
    fraud = Transaction.query.filter_by(prediction='Fraud').count()
    genuine = Transaction.query.filter(Transaction.prediction.in_(['Genuine', 'Not Fraud'])).count()
    fraud_rate = round((fraud / total * 100) if total > 0 else 0, 2)
    
    # Get trend data (last 10 transactions)
    recent_txns = Transaction.query.order_by(Transaction.created_at.desc()).limit(10).all()
    trend = [
        {
            "time": t.transaction_time or f"T{i}",
            "fraud": 1 if t.prediction == 'Fraud' else 0,
            "genuine": 1 if t.prediction in ['Genuine', 'Not Fraud'] else 0
        }
        for i, t in enumerate(reversed(recent_txns))
    ]
    
    # Get merchant aggregation
    merchants_data = db.session.query(
        Transaction.merchant_category,
        db.func.count(Transaction.id).label('count')
    ).group_by(Transaction.merchant_category).all()
    
    merchants = [
        {"name": m[0] or 'Unknown', "value": m[1]}
        for m in merchants_data
    ]
    
    return jsonify({
        'success': True,
        'total_transactions': total,
        'fraud_transactions': fraud,
        'genuine_transactions': genuine,
        'fraud_rate': fraud_rate,
        'fraud_trends': trend,
        'fraud_by_merchant': merchants,
        'recent_transactions': [
            {
                'transaction_id': t.transaction_id,
                'customer_id': t.customer_id,
                'amount': t.amount,
                'time': t.transaction_time,
                'merchant': t.merchant_category,
                'risk_score': t.risk_score,
                'prediction': 'Genuine' if t.prediction in ['Genuine', 'Not Fraud'] else t.prediction,
                'status': 'High Risk' if t.risk_score >= 75 else ('Medium Risk' if t.risk_score >= 40 else 'Low Risk'),
                'location': t.location
            }
            for t in recent_txns[:10]
        ]
    }), 200


# ==================== Transaction Routes ====================

@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    """Get all transactions with optional filtering."""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    search = request.args.get('search', '', type=str)
    filter_type = request.args.get('filter', 'All', type=str)
    
    query = Transaction.query
    
    # Apply search filter
    if search:
        query = query.filter(
            db.or_(
                Transaction.transaction_id.ilike(f'%{search}%'),
                Transaction.customer_id.ilike(f'%{search}%'),
                Transaction.merchant_category.ilike(f'%{search}%')
            )
        )
    
    # Apply prediction/status filter
    if filter_type == 'Fraud':
        query = query.filter_by(prediction='Fraud')
    elif filter_type == 'Genuine' or filter_type == 'Not Fraud':
        query = query.filter(Transaction.prediction.in_(['Genuine', 'Not Fraud']))
    elif filter_type == 'High Risk':
        query = query.filter(Transaction.risk_score >= 75)
    elif filter_type == 'Medium Risk':
        query = query.filter((Transaction.risk_score >= 40) & (Transaction.risk_score < 75))
    elif filter_type == 'Low Risk':
        query = query.filter(Transaction.risk_score < 40)
    
    # Order by most recent
    query = query.order_by(Transaction.created_at.desc())
    
    # Paginate
    transactions = query.paginate(page=page, per_page=limit)
    
    return jsonify({
        'success': True,
        'data': [
            {
                'transaction_id': t.transaction_id,
                'customer_id': t.customer_id,
                'amount': t.amount,
                'time': t.transaction_time,
                'merchant': t.merchant_category,
                'risk_score': t.risk_score,
                'prediction': 'Genuine' if t.prediction in ['Genuine', 'Not Fraud'] else t.prediction,
                'status': 'High Risk' if t.risk_score >= 75 else ('Medium Risk' if t.risk_score >= 40 else 'Low Risk'),
                'location': t.location
            }
            for t in transactions.items
        ],
        'total': transactions.total,
        'pages': transactions.pages,
        'current_page': page
    }), 200


@app.route('/api/transactions/<transaction_id>', methods=['GET'])
@login_required
def get_transaction_detail(transaction_id):
    """Get a specific transaction with SHAP values."""
    txn = Transaction.query.filter_by(transaction_id=transaction_id).first()
    
    if not txn:
        return jsonify({'success': False, 'message': 'Transaction not found'}), 404
    
    # Get SHAP values for this transaction
    shap_vals = ShapExplanation.query.filter_by(transaction_id=transaction_id).all()
    shap_list = [
        {
            'feature': s.feature_name,
            'value': s.feature_value,
            'impact': s.shap_value
        }
        for s in shap_vals
    ]

    explanation = _generate_explanation(shap_list, txn.prediction) if shap_list else None
    shap_metadata = {
        "explainer": "SHAP KernelExplainer",
        "methodology": "Stored SHAP values generated by the FraudNova hybrid pipeline.",
        "space": "preprocessed model features",
        "output": "hybrid fraud-class model output (uncalibrated decision score)",
        "positive_direction": "Fraud",
        "negative_direction": "Genuine",
        "model_version": "2.4.0-colab",
        "source": "stored transaction explanation",
    } if shap_list else None
    if not shap_list:
        if not ml_service.is_loaded:
            return jsonify({
                'success': False,
                'message': 'SHAP explanation is unavailable because the trained model is not loaded.',
                'model_error': ml_service.load_error,
            }), 503
        try:
            model_result = ml_service.predict_transaction(
                _transaction_model_input(txn),
                include_shap=True,
            )
            shap_list = model_result['shap']
            explanation = model_result['explanation']
            shap_metadata = model_result.get('shap_metadata')
            for shap_val in shap_list:
                db.session.add(ShapExplanation(
                    transaction_id=txn.transaction_id,
                    feature_name=shap_val['feature'],
                    feature_value=str(shap_val['value']),
                    shap_value=shap_val['impact'],
                ))
            db.session.commit()
        except Exception as exc:
            db.session.rollback()
            app.logger.exception("Transaction SHAP explanation failed")
            return jsonify({
                'success': False,
                'message': 'SHAP explanation could not be generated for this transaction.',
                'model_error': str(exc),
            }), 503
    
    return jsonify({
        'success': True,
        'transaction_id': txn.transaction_id,
        'customer_id': txn.customer_id,
        'amount': txn.amount,
        'time': txn.transaction_time,
        'merchant_category': txn.merchant_category,
        'payment_method': txn.payment_method,
        'location': txn.location,
        'device_type': txn.device_type,
        'transaction_frequency': txn.transaction_frequency,
        'average_spending': txn.average_spending,
        'previous_transaction_amount': txn.previous_transaction_amount,
        'distance_from_previous_location': txn.distance_from_previous_location,
        'prediction': txn.prediction,
        'risk_score': txn.risk_score,
        'confidence': txn.confidence,
        'shap': shap_list,
        'shap_metadata': shap_metadata,
        'explanation': explanation,
        'created_at': txn.created_at.isoformat() if txn.created_at else None
    }), 200


# ==================== Alerts Route ====================

@app.route('/api/alerts', methods=['GET'])
@login_required
def get_alerts():
    """Get high-risk transactions (alerts)."""
    alerts = Transaction.query.filter(Transaction.risk_score >= 70).order_by(Transaction.created_at.desc()).limit(10).all()
    
    return jsonify({
        'success': True,
        'data': [
            {
                'transaction_id': a.transaction_id,
                'customer_id': a.customer_id,
                'amount': a.amount,
                'time': a.transaction_time,
                'risk_score': a.risk_score,
                'prediction': a.prediction,
                'status': 'High Risk' if a.risk_score >= 75 else 'Medium Risk',
                'reason': f'{a.merchant_category} transaction of {a.amount} from {a.location}'
            }
            for a in alerts
        ]
    }), 200


# ==================== Model Info & Reload Routes ====================

@app.route('/api/model-info', methods=['GET'])
@login_required
def model_info():
    """Get model information from ML service."""
    info = ml_service.get_model_info()
    return jsonify({
        'success': True,
        'name': info.get('model_name', 'FraudNova AI Model'),
        'version': info.get('version', '2.4.0-colab'),
        'description': 'Quantum-enhanced fraud detection system with CNN+BiLSTM and QSVM',
        'components': info.get('components', ['CNN + LSTM', 'QCNN', 'QSVM', 'VQE + QAOA']),
        'shap_enabled': True,
        'ml_loaded': info.get('loaded', False),
        'metrics': info.get('metrics', {}),
        'architecture': info.get('architecture', {}),
        'artifacts': info.get('artifacts', {}),
        'explainability': info.get('explainability', {})
    }), 200


# ==================== Error Handlers ====================

@app.errorhandler(404)
def not_found_error(error):
    return jsonify({'success': False, 'message': 'Resource not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500


@app.route('/api/model/reload', methods=['POST'])
@login_required
def reload_models():
    """Reload ML model artifacts from disk without restarting server."""
    success = ml_service.load_models()
    if success:
        return jsonify({
            'success': True,
            'message': 'ML models reloaded successfully',
            'info': ml_service.get_model_info()
        }), 200
    else:
        return jsonify({
            'success': False,
            'message': f'Failed to reload models: {ml_service.load_error}'
        }), 500


# ==================== Initialize Database ====================

# ==================== Initialize Database ====================

def init_db():
    """Initialize database tables and default data."""
    with app.app_context():
        db.create_all()

        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)

            if 'users' in inspector.get_table_names():
                columns = [
                    col['name']
                    for col in inspector.get_columns('users')
                ]

                if 'email' not in columns:
                    db.session.execute(
                        text("ALTER TABLE users ADD COLUMN email VARCHAR(120)")
                    )

                if 'full_name' not in columns:
                    db.session.execute(
                        text("ALTER TABLE users ADD COLUMN full_name VARCHAR(120)")
                    )

                db.session.commit()

        except Exception as e:
            db.session.rollback()
            print("Database migration check note:", str(e))

        create_or_get_admin_user()


# Initialize database for Render/Gunicorn
with app.app_context():
    init_db()


# ==================== Main ====================

if __name__ == '__main__':
    print("\n" + "="*50)
    print("  FraudNova AI Backend Server Running")
    print("  URL: http://127.0.0.1:5000")
    print("="*50 + "\n")

    app.run(host='0.0.0.0', port=5000, debug=True)
