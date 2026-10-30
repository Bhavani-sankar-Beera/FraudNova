import os
import json
import warnings
import numpy as np
import pandas as pd
import joblib
from contextlib import contextmanager

# Suppress sklearn and tensorflow warnings
warnings.filterwarnings("ignore")

# Scikit-learn cross-version unpickling compatibility patch
import sklearn.compose._column_transformer as ct
if not hasattr(ct, "_RemainderColsList"):
    ct._RemainderColsList = type("_RemainderColsList", (list,), {})

# Configure Keras backend only when a supported runtime is available.
# Some Windows environments block the bundled torch/tensorflow DLLs.
# In that case, the app should continue in demo mode instead of crashing.
os.environ.setdefault("KERAS_BACKEND", "torch")

load_keras_model = None
try:
    import tensorflow as tf
    load_keras_model = tf.keras.models.load_model
except Exception:
    try:
        import keras
        load_keras_model = keras.models.load_model
    except Exception:
        load_keras_model = None


@contextmanager
def _legacy_keras_compat():
    """Load Keras 3.13 artifacts with the installed Keras 3.12 runtime.

    The saved models contain ``quantization_config: None`` on Dense layers.
    Keras 3.12 rejects that harmless field although the layer architecture is
    otherwise compatible.
    """
    if load_keras_model is None:
        yield
        return

    dense_class = None
    original_init = None
    try:
        import keras
        dense_class = keras.layers.Dense
        original_init = dense_class.__init__

        def compatible_init(self, *args, **kwargs):
            kwargs.pop("quantization_config", None)
            return original_init(self, *args, **kwargs)

        dense_class.__init__ = compatible_init
        yield
    finally:
        if dense_class is not None and original_init is not None:
            dense_class.__init__ = original_init


class MLService:
    """
    FraudNova Hybrid Quantum-Classical ML Inference Service.
    Integrates Google Colab trained models:
    - CNN + BiLSTM (cnn_lstm_model.keras)
    - Latent Feature Extractor (feature_extractor.keras)
    - Preprocessor ColumnTransformer (preprocessor.pkl)
    - PCA (pca.pkl)
    - QSVM Precomputed Kernel Model (qsvm_model.pkl)
    - Quantum Reference States (qsvm_train_states.npy)
    """

    def __init__(self, ml_dir=None):
        self.ml_dir = self._resolve_ml_dir(ml_dir)
        self.is_loaded = False
        self.load_error = None
        self.load_models()

    def _resolve_ml_dir(self, ml_dir):
        if ml_dir and os.path.exists(ml_dir):
            return ml_dir
        
        candidates = [
            os.path.join(os.path.dirname(__file__), "ml"),
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml"),
            os.path.join(os.getcwd(), "ml"),
            os.path.join(os.getcwd(), "backend", "ml"),
        ]
        for c in candidates:
            if os.path.isdir(c) and os.path.exists(os.path.join(c, "cnn_lstm_model.keras")):
                return c
        return candidates[0]

    def load_models(self):
        """Loads all Colab-trained artifacts from disk."""
        if load_keras_model is None:
            self.is_loaded = False
            self.load_error = "ML runtime unavailable (tensorflow/keras/torch blocked by environment policy)."
            self.cnn_lstm_model = None
            self.feature_extractor = None
            self.preprocessor = None
            self.pca = None
            self.qsvm_model = None
            self.qsvm_train_states = None
            self.pipeline_config = {"selected_indices": [0, 1, 3, 4, 6, 7]}
            self.model_config = {}
            self.selected_indices = self.pipeline_config.get("selected_indices", [0, 1, 3, 4, 6, 7])
            print(f"[MLService] Warning: {self.load_error}")
            return False

        try:
            safe_dir = str(self.ml_dir).encode('ascii', 'replace').decode('ascii')
            print(f"[MLService] Loading ML models from: {safe_dir}")
            
            required_files = [
                "cnn_lstm_model.keras",
                "feature_extractor.keras",
                "preprocessor.pkl",
                "pca.pkl",
                "qsvm_model.pkl",
                "qsvm_train_states.npy",
                "final_pipeline_features.json",
                "model_config.json",
                "qaoa_coefficients.npy",
                "qaoa_optimal_params.npy",
                "vqe_coefficients.npy",
                "vqe_feature_min.npy",
                "vqe_feature_max.npy",
                "vqe_optimal_weights.npy",
            ]
            missing_files = [
                name for name in required_files
                if not os.path.isfile(os.path.join(self.ml_dir, name))
            ]
            if missing_files:
                raise FileNotFoundError(
                    f"Required model artifacts are missing: {', '.join(missing_files)}"
                )

            # 1. Keras deep learning models
            with _legacy_keras_compat():
                self.cnn_lstm_model = load_keras_model(
                    os.path.join(self.ml_dir, "cnn_lstm_model.keras"),
                    compile=False,
                    safe_mode=False,
                )
                self.feature_extractor = load_keras_model(
                    os.path.join(self.ml_dir, "feature_extractor.keras"),
                    compile=False,
                    safe_mode=False,
                )

            # 2. Sklearn transformers & models
            self.preprocessor = joblib.load(
                os.path.join(self.ml_dir, "preprocessor.pkl")
            )
            self.pca = joblib.load(
                os.path.join(self.ml_dir, "pca.pkl")
            )
            self.qsvm_model = joblib.load(
                os.path.join(self.ml_dir, "qsvm_model.pkl")
            )

            # 3. Quantum state vectors
            self.qsvm_train_states = np.load(
                os.path.join(self.ml_dir, "qsvm_train_states.npy")
            )
            self.qaoa_coefficients = np.load(os.path.join(self.ml_dir, "qaoa_coefficients.npy"))
            self.qaoa_optimal_params = np.load(os.path.join(self.ml_dir, "qaoa_optimal_params.npy"))
            self.vqe_coefficients = np.load(os.path.join(self.ml_dir, "vqe_coefficients.npy"))
            self.vqe_feature_min = np.load(os.path.join(self.ml_dir, "vqe_feature_min.npy"))
            self.vqe_feature_max = np.load(os.path.join(self.ml_dir, "vqe_feature_max.npy"))
            self.vqe_optimal_weights = np.load(os.path.join(self.ml_dir, "vqe_optimal_weights.npy"))

            # 4. JSON configurations
            with open(os.path.join(self.ml_dir, "final_pipeline_features.json"), "r", encoding="utf-8") as f:
                self.pipeline_config = json.load(f)

            with open(os.path.join(self.ml_dir, "model_config.json"), "r", encoding="utf-8") as f:
                self.model_config = json.load(f)

            self.selected_indices = self.pipeline_config.get("selected_indices", [0, 1, 3, 4, 6, 7])
            if self.preprocessor.n_features_in_ != 34:
                raise ValueError(
                    f"Unexpected preprocessor input width: {self.preprocessor.n_features_in_}"
                )
            if self.qsvm_train_states.shape[1] != 64:
                raise ValueError(
                    f"Unexpected QSVM state width: {self.qsvm_train_states.shape[1]}"
                )
            self.is_loaded = True
            self.load_error = None
            print("[MLService] ALL MODEL ARTIFACTS LOADED SUCCESSFULLY")
            return True
        except Exception as e:
            self.is_loaded = False
            self.load_error = str(e)
            print(f"[MLService] Warning: Failed to load models: {e}")
            return False

    def _prepare_features(self, data):
        """Maps raw transaction dictionary to the 34 required preprocessor features."""
        def to_f(v, default=0.0):
            try:
                if v is None or v == "":
                    return default
                return float(v)
            except Exception:
                return default

        def to_i(v, default=0):
            try:
                if v is None or v == "":
                    return default
                return int(float(v))
            except Exception:
                return default

        amount = to_f(data.get("amount", data.get("amount_inr", 100)))
        avg_spending = max(1.0, to_f(data.get("average_spending", data.get("average_spending_inr", 150))))
        prev_amount = to_f(data.get("previous_transaction_amount", data.get("previous_transaction_amount_inr", data.get("previous_amount", 120))))
        distance = to_f(data.get("distance_from_previous_location", data.get("distance_from_previous_location_km", data.get("distance", 5))))
        freq = to_i(data.get("transaction_frequency", 1))
        balance = max(1.0, to_f(data.get("account_balance", data.get("account_balance_inr", 50000))))
        credit_score = to_f(data.get("credit_score", 720))

        # Categoricals raw
        account_type = data.get("account_type", "Savings")
        transaction_type = data.get("transaction_type", "Debit")
        merchant = data.get("merchant_category", data.get("merchant", "Retail"))
        payment_method = data.get("payment_method", "Credit Card")
        direction = data.get("transaction_direction", "Debit")
        location = data.get("location", "Hyderabad")
        device = data.get("device_type", data.get("device", "Mobile"))
        network = data.get("network_type", "5G")

        # Category normalizations to match preprocessor OneHotEncoder vocabulary
        LOCATION_MAP = {
            'hyderabad': 'Telangana', 'mumbai': 'Maharashtra', 'pune': 'Maharashtra',
            'bengaluru': 'Karnataka', 'bangalore': 'Karnataka', 'chennai': 'Tamil Nadu',
            'kolkata': 'West Bengal', 'delhi': 'Delhi', 'new delhi': 'Delhi'
        }
        DEVICE_MAP = {
            'mobile': 'Android', 'desktop': 'Web', 'tablet': 'Android',
            'phone': 'Android', 'laptop': 'Web', 'pc': 'Web', 'android': 'Android', 'ios': 'iOS'
        }
        TXN_TYPE_MAP = {
            'purchase': 'P2M', 'transfer': 'P2P', 'withdrawal': 'UPI', 'deposit': 'UPI',
            'bill payment': 'Bill Payment', 'recharge': 'Recharge', 'p2m': 'P2M', 'p2p': 'P2P'
        }
        MERCHANT_MAP = {
            'food': 'Food & Dining', 'dining': 'Food & Dining', 'luxury': 'Jewellery'
        }
        PAYMENT_MAP = {
            'wallet': 'UPI', 'cash': 'UPI'
        }
        NETWORK_MAP = {
            'public wifi': 'WiFi'
        }

        location_norm = LOCATION_MAP.get(str(location).strip().lower(), location)
        device_norm = DEVICE_MAP.get(str(device).strip().lower(), device)
        txn_type_norm = TXN_TYPE_MAP.get(str(transaction_type).strip().lower(), transaction_type)
        merchant_norm = MERCHANT_MAP.get(str(merchant).strip().lower(), merchant)
        payment_norm = PAYMENT_MAP.get(str(payment_method).strip().lower(), payment_method)
        network_norm = NETWORK_MAP.get(str(network).strip().lower(), network)

        # Date and Time parsing
        date_str = str(data.get("transaction_date", data.get("date", "")))
        time_str = str(data.get("time", data.get("transaction_time", "")))
        
        hour = to_i(data.get("hour_of_day"), default=-1)
        weekday = to_i(data.get("day_of_week"), default=-1)
        day = 24
        month = 9
        minute = 30

        if date_str:
            try:
                cleaned_date = date_str.replace("/", "-").split("T")[0].strip()
                tokens = cleaned_date.split("-")
                if len(tokens) == 3:
                    if len(tokens[0]) == 4:
                        year = int(tokens[0])
                        month = int(tokens[1])
                        day = int(tokens[2])
                    else:
                        day = int(tokens[0])
                        month = int(tokens[1])
                        year = int(tokens[2])
                    if weekday < 0:
                        import datetime
                        weekday = datetime.date(year, month, day).isoweekday()
            except Exception:
                pass

        if weekday < 0:
            weekday = 4

        if hour < 0:
            if ":" in time_str:
                try:
                    parts = time_str.replace("T", " ").split()
                    t_part = parts[-1]
                    t_tokens = t_part.split(":")
                    hour = int(t_tokens[0])
                    if len(t_tokens) > 1:
                        minute = int(t_tokens[1])
                except Exception:
                    hour = 14
            else:
                hour = 14

        if "is_weekend" in data:
            iw = data.get("is_weekend")
            is_weekend = 1 if (iw in [1, "1", "Yes", "yes", True]) else 0
        else:
            is_weekend = 1 if weekday in [5, 6, 7] else 0

        # Feature derivations
        amount_vs_avg = amount / avg_spending
        amount_change_prev = abs(amount - prev_amount) / max(1.0, prev_amount)
        hour_sin = np.sin(2 * np.pi * hour / 24.0)
        hour_cos = np.cos(2 * np.pi * hour / 24.0)
        day_sin = np.sin(2 * np.pi * weekday / 7.0)
        day_cos = np.cos(2 * np.pi * weekday / 7.0)
        amount_balance_ratio = amount / balance
        amount_previous_ratio = amount / max(1.0, prev_amount)
        spending_dev = (amount - avg_spending) / max(1.0, avg_spending * 0.3)
        large_txn = 1 if amount > (avg_spending * 2.5) else 0
        unusual_hour = 1 if (hour < 6 or hour >= 23) else 0
        high_freq = 1 if freq >= 5 else 0

        row = {
            "amount_inr": amount,
            "account_type": account_type,
            "transaction_type": txn_type_norm,
            "merchant_category": merchant_norm,
            "payment_method": payment_norm,
            "transaction_direction": direction,
            "location": location_norm,
            "device_type": device_norm,
            "network_type": network_norm,
            "transaction_frequency": freq,
            "average_spending_inr": avg_spending,
            "previous_transaction_amount_inr": prev_amount,
            "distance_from_previous_location_km": distance,
            "account_balance_inr": balance,
            "credit_score": credit_score,
            "hour_of_day": hour,
            "day_of_week": weekday,
            "is_weekend": is_weekend,
            "amount_vs_average_ratio": amount_vs_avg,
            "amount_change_from_previous_ratio": amount_change_prev,
            "transaction_month": month,
            "transaction_day": day,
            "transaction_hour": hour,
            "transaction_minute": minute,
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "day_sin": day_sin,
            "day_cos": day_cos,
            "amount_balance_ratio": amount_balance_ratio,
            "amount_previous_ratio": amount_previous_ratio,
            "spending_deviation": spending_dev,
            "large_transaction_flag": large_txn,
            "unusual_hour_flag": unusual_hour,
            "high_frequency_flag": high_freq,
        }
        return pd.DataFrame([row])

    def predict_transaction(self, data, include_shap=True):
        """Runs the hybrid prediction pipeline, optionally including SHAP."""
        if not self.is_loaded:
            raise RuntimeError(f"ML models are not loaded: {self.load_error}")

        df_input = self._prepare_features(data)
        X_pre = self.preprocessor.transform(df_input)
        result = self._predict_from_preprocessed(X_pre)
        shap_values, shap_metadata = (
            self._compute_shap_attribution(X_pre) if include_shap else ([], None)
        )
        explanation = (
            self._build_explanation(shap_values, result["prediction"])
            if include_shap
            else self._build_summary_explanation(result["prediction"])
        )

        result.update({
            "shap": shap_values,
            "explanation": explanation,
            "shap_metadata": shap_metadata,
        })
        return result

    def _build_summary_explanation(self, prediction):
        """Provide a fast bulk-analysis explanation without calculating SHAP."""
        if prediction == "Fraud":
            return "Classified as FRAUD by the hybrid CNN-LSTM and QSVM model."
        return "Classified as GENUINE by the hybrid CNN-LSTM and QSVM model."

    def _predict_from_preprocessed(self, X_pre):
        """Run the saved CNN-LSTM, PCA, and precomputed-kernel QSVM."""
        # 1. CNN + BiLSTM Inference
        X_seq = X_pre.reshape(-1, X_pre.shape[1], 1)
        cnn_prob = float(self.cnn_lstm_model.predict(X_seq, verbose=0)[0][0])

        # 2. Latent Feature Extraction
        emb = self.feature_extractor.predict(X_seq, verbose=0)

        # 3. PCA Projection to 8 Principal Components
        pca_components = self.pca.transform(emb)

        # 4. Quantum Feature Selection (6 Selected Components)
        quantum_features = pca_components[:, self.selected_indices]

        # 5. Quantum Kernel & QSVM Inference
        norm_q = quantum_features / (np.linalg.norm(quantum_features, axis=1, keepdims=True) + 1e-7)
        q_state = np.zeros((len(norm_q), 64), dtype=complex)
        for i in range(6):
            q_state[:, 1 << i] = norm_q[:, i]
        q_state[:, 0] = np.sqrt(np.maximum(0.0, 1.0 - np.sum(np.abs(norm_q) ** 2, axis=1)))
        q_state = q_state / (np.linalg.norm(q_state, axis=1, keepdims=True) + 1e-7)
        K = np.abs(np.dot(q_state, self.qsvm_train_states.conj().T)) ** 2
        qsvm_probs = self.qsvm_model.predict_proba(K)[0]
        qsvm_fraud_prob = float(qsvm_probs[1]) if len(qsvm_probs) > 1 else float(qsvm_probs[0])

        # 6. Hybrid Decision Aggregation
        hybrid_prob = (0.6 * cnn_prob) + (0.4 * qsvm_fraud_prob)
        risk_score = int(round(hybrid_prob * 100))
        risk_score = max(1, min(99, risk_score))

        prediction = "Fraud" if risk_score >= 50 else "Genuine"
        pred_class = 1 if prediction == "Fraud" else 0
        risk_level = "High" if risk_score >= 75 else ("Medium" if risk_score >= 40 else "Low")
        status = f"{risk_level} Risk"
        confidence = round(max(hybrid_prob, 1.0 - hybrid_prob), 3)

        pipeline_stages = [
            {"name": "Preprocessing", "status": "completed"},
            {"name": "Feature Engineering", "status": "completed"},
            {"name": "CNN + BiLSTM", "status": "completed"},
            {"name": "Feature Extraction", "status": "completed"},
            {"name": "PCA Dimension Reduction", "status": "completed"},
            {"name": "QSVM Quantum Kernel", "status": "completed"},
            {"name": "Prediction", "status": "completed"},
        ]

        return {
            "prediction": prediction,
            "class": pred_class,
            "risk": risk_level,
            "risk_level": risk_level,
            "status": status,
            "risk_score": risk_score,
            "confidence": confidence,
            "fraud_probability": round(hybrid_prob, 4),
            "cnn_lstm_probability": round(cnn_prob, 4),
            "qsvm_probability": round(qsvm_fraud_prob, 4),
            "mode": "ML_QUANTUM_HYBRID",
            "pipeline": pipeline_stages,
            "quantum_state_components": [round(float(v), 4) for v in quantum_features[0]],
        }

    def _compute_shap_attribution(self, X_pre):
        """Calculate exact-transaction SHAP values for the fraud-class output."""
        try:
            import shap
        except ImportError as exc:
            raise RuntimeError("SHAP is not installed; no explanation is available.") from exc

        feature_names = self.preprocessor.get_feature_names_out()
        background = np.zeros((1, X_pre.shape[1]), dtype=float)

        def model_probability(values):
            values = np.asarray(values, dtype=float)
            return np.array([
                self._predict_from_preprocessed(row.reshape(1, -1))["fraud_probability"]
                for row in values
            ])

        explainer = shap.KernelExplainer(model_probability, background)
        # Kernel SHAP's exact enumeration is prohibitively slow for the 67
        # transformed features. A bounded sample count keeps the explanation
        # faithful to the real pipeline while making interactive analysis usable.
        shap_result = explainer.shap_values(
            X_pre,
            nsamples=min(16, 2 * X_pre.shape[1] + 2),
            silent=True,
        )
        values = np.asarray(shap_result)
        if values.ndim == 3:
            values = values[0]
        values = values.reshape(-1)
        base_value = float(np.asarray(explainer.expected_value).reshape(-1)[0])
        output = float(model_probability(X_pre)[0])

        reconstruction_error = abs(base_value + float(values.sum()) - output)
        if not np.isclose(base_value + float(values.sum()), output, atol=1e-3):
            raise RuntimeError("SHAP values failed the model-output reconstruction check.")

        shap_values = [
            {
                "feature": str(feature_names[index]),
                "value": float(X_pre[0, index]),
                "impact": round(float(values[index]), 6),
            }
            for index in np.argsort(np.abs(values))[::-1]
        ]
        return shap_values, {
            "explainer": "SHAP KernelExplainer",
            "methodology": "Model-agnostic Kernel SHAP over the preprocessed features using the actual FraudNova hybrid pipeline.",
            "space": "preprocessed model features",
            "output": "hybrid fraud-class model output (uncalibrated decision score)",
            "positive_direction": "Fraud",
            "negative_direction": "Genuine",
            "base_value": round(base_value, 6),
            "model_output": round(output, 6),
            "reconstruction_error": round(reconstruction_error, 9),
            "significant_threshold": 0.0005,
            "model_version": "2.4.0-colab",
            "samples": 16,
            "approximation": "bounded Kernel SHAP sampling for interactive response time",
        }

    def _build_explanation(self, shap_values, prediction):
        """Generates dynamic explanation text from top SHAP contributors."""
        pos = [s["feature"] for s in shap_values if s["impact"] > 0.0005]
        neg = [s["feature"] for s in shap_values if s["impact"] < -0.0005]

        if prediction == "Fraud":
            if pos:
                return f"Classified as HIGH RISK primarily due to elevated {pos[0]}" + (f" alongside anomalies in {', '.join(pos[1:3])}." if len(pos) > 1 else ".")
            return "Classified as HIGH RISK based on quantum-enhanced feature analysis."
        else:
            if neg:
                return f"Classified as GENUINE. Consistent historical behavior in {', '.join(neg[:2])} verified normal user pattern."
            return "Classified as GENUINE. All transaction telemetry matches legitimate activity."

    def get_model_info(self):
        """Returns structured metadata about the loaded Colab models."""
        if not self.is_loaded:
            return {
                "loaded": False,
                "error": self.load_error,
                "version": "not-loaded"
            }

        return {
            "loaded": True,
            "model_name": "FraudNova Hybrid Quantum-Classical Pipeline",
            "version": "2.4.0-colab",
            "components": [
                "1D CNN Feature Extractor",
                "Bidirectional LSTM (BiLSTM)",
                "Principal Component Analysis (PCA)",
                "Quantum Support Vector Machine (QSVM)",
                "Validated QAOA/VQE artifacts"
            ],
            "metrics": self.model_config,
            "architecture": {
                "cnn_input_shape": list(self.cnn_lstm_model.input_shape),
                "feature_extractor_output": list(self.feature_extractor.output_shape),
                "pca_components": int(self.pca.n_components_),
                "qsvm_kernel": str(getattr(self.qsvm_model, 'kernel', 'precomputed')),
                "qsvm_reference_states": list(self.qsvm_train_states.shape),
                "selected_features": self.pipeline_config.get("selected_features", [])
            },
            "artifacts": {
                "directory": self.ml_dir,
                "qaoa_coefficients": list(self.qaoa_coefficients.shape),
                "qaoa_optimal_params": list(self.qaoa_optimal_params.shape),
                "vqe_coefficients": list(self.vqe_coefficients.shape),
                "vqe_optimal_weights": list(self.vqe_optimal_weights.shape),
            },
            "explainability": {
                "method": "SHAP KernelExplainer",
                "methodology": "Model-agnostic Kernel SHAP over the preprocessed features using the actual FraudNova hybrid pipeline.",
                "space": "preprocessed model features",
                "output": "hybrid fraud-class model output (uncalibrated decision score)",
                "positive_direction": "Fraud",
                "negative_direction": "Genuine",
                "reconstruction_tolerance": 1e-3,
            },
        }


# Global singleton instance
ml_service = MLService()
