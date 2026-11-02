"""Prediction helper for the Flask API; synthetic legacy models are never loaded."""

import json
import logging
import math
import os
from decimal import Decimal, ROUND_HALF_UP

import joblib
import numpy as np


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, "saved_model")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
INFO_PATH = os.path.join(MODEL_DIR, "model_info.json")
MODEL_NOT_TRAINED_MESSAGE = "Model Not Trained – Genuine Historical Examination Data Required."
EXPECTED_FEATURES = (
    "attendance_pct",
    "assignment_1_marks",
    "assignment_2_marks",
    "class_test_1_marks",
    "class_test_2_marks",
    "combined_class_test_marks",
    "presentation_marks",
    "internal_total",
)

_model = None
_model_info = None
MODEL_READY = False
MODEL_LOAD_ERROR = None


def _disable_model(reason):
    global _model, _model_info, MODEL_READY, MODEL_LOAD_ERROR
    _model = None
    _model_info = None
    MODEL_READY = False
    MODEL_LOAD_ERROR = reason
    return False


def _compatible_model(model, info):
    if not isinstance(info, dict):
        return False, "The model metadata has an invalid format."
    features = info.get("features")
    expected_features = list(EXPECTED_FEATURES)
    if features == expected_features + ["previous_semester_marks"]:
        expected_features.append("previous_semester_marks")
    if features != expected_features:
        return False, "The model feature names or order do not match the current assessment structure."
    if info.get("target") != "actual_semester_marks":
        return False, "The model target is not actual end-semester examination marks."
    try:
        dataset_size = int(info.get("dataset_size", 0))
        test_size = int(info.get("test_size", 0))
    except (OverflowError, TypeError, ValueError):
        return False, "The model training metadata is incomplete."
    metrics = info.get("metrics")
    if dataset_size < 10 or test_size < 2 or not isinstance(metrics, dict):
        return False, "The model does not have sufficient genuine held-out evaluation data."
    if not {"mae", "mse", "rmse", "r2"}.issubset(metrics):
        return False, "The model evaluation metrics are incomplete."
    try:
        if not all(math.isfinite(float(metrics[name])) for name in ("mae", "mse", "rmse", "r2")):
            return False, "The model evaluation metrics are invalid."
    except (TypeError, ValueError):
        return False, "The model evaluation metrics are invalid."
    if not callable(getattr(model, "predict", None)):
        return False, "The saved model does not support prediction."
    model_features = getattr(model, "feature_names_in_", None)
    if model_features is None or list(model_features) != expected_features:
        return False, "The saved model's fitted feature names or order are incompatible."
    return True, None


def load_model():
    """Load the artifact and metadata together, including after an admin retrain."""
    global _model, _model_info, MODEL_READY, MODEL_LOAD_ERROR
    try:
        with open(INFO_PATH, encoding="utf-8") as file:
            candidate_info = json.load(file)
    except (OSError, json.JSONDecodeError) as error:
        return _disable_model(f"Model metadata could not be read: {error}")
    if not isinstance(candidate_info, dict):
        return _disable_model("The model metadata has an invalid format.")
    if candidate_info.get("training_status") != "trained":
        return _disable_model(candidate_info.get("status_message", MODEL_NOT_TRAINED_MESSAGE))
    if not os.path.isfile(MODEL_PATH):
        return _disable_model("The trained model artifact is missing.")
    try:
        candidate_model = joblib.load(MODEL_PATH)
    except Exception as error:
        logging.getLogger(__name__).exception("The saved prediction model artifact could not be loaded.")
        return _disable_model(f"The trained model artifact could not be loaded: {error}")
    compatible, reason = _compatible_model(candidate_model, candidate_info)
    if not compatible:
        return _disable_model(reason)
    _model = candidate_model
    _model_info = candidate_info
    MODEL_READY = True
    MODEL_LOAD_ERROR = None
    return True


load_model()


def get_performance_category(overall_marks):
    """Classify the estimated total (internal + end-semester) out of 100."""
    if overall_marks >= 80:
        return "Excellent"
    if overall_marks >= 60:
        return "Good"
    if overall_marks >= 40:
        return "Average"
    return "Needs Improvement"


def get_suggestions(predicted_semester_marks, features):
    suggestions = []
    if features["attendance_pct"] < 75:
        suggestions.append("Improve attendance and aim for at least 75% to stay eligible for examinations.")
    if features["internal_total"] < 20:
        suggestions.append("Review the internal assessment components and discuss areas for improvement with faculty.")
    if predicted_semester_marks < 24:
        suggestions.append("Seek additional support from faculty for end-semester examination preparation.")
    if not suggestions:
        suggestions.append("Continue your consistent academic effort across internal assessments and examination preparation.")
    return suggestions


def estimate_end_semester(input_data):
    """Return the explicitly non-ML provisional estimate for a valid assessment."""
    internal_total = Decimal(str(input_data["internal_total"]))
    attendance_pct = Decimal(str(input_data["attendance_pct"]))
    estimate = Decimal(60) * (
        Decimal("0.8") * (internal_total / Decimal(40))
        + Decimal("0.2") * (attendance_pct / Decimal(100))
    )
    estimate = estimate.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    predicted_semester_marks = max(Decimal(0), min(Decimal(60), estimate))
    semester_marks = int(predicted_semester_marks)
    overall_marks = round(float(internal_total + predicted_semester_marks), 2)
    category = get_performance_category(overall_marks)
    return {
        "predicted_semester_marks": semester_marks,
        "estimated_overall_marks": overall_marks,
        "performance_category": category,
        "explanation": (
            f"Provisional rule-based estimate: {semester_marks}/60 for the end-semester exam. "
            f"Estimated overall marks are {overall_marks:.2f}/100 using "
            f"{float(internal_total):.2f}/40 actual internal marks."
        ),
        "disclaimer": "Estimate – Not ML Prediction. This is a provisional rule-based estimate, not an actual exam result or trained-model prediction.",
        "suggestions": get_suggestions(semester_marks, input_data),
        "feature_importance": {},
        "prediction_type": "rule_based_estimate",
        "model_version": None,
    }


def predict(input_data):
    if not MODEL_READY or _model is None or _model_info is None:
        raise RuntimeError(
            "No model trained on genuine examination records is available. "
            "Provide historical records with actual end-semester marks to ml/train_model.py."
        )

    feature_names = _model_info["features"]
    values = [
        np.nan if input_data.get(name) is None else float(input_data[name])
        for name in feature_names
    ]
    raw_prediction = float(_model.predict(np.asarray([values], dtype=float))[0])
    predicted_semester_marks = round(float(np.clip(raw_prediction, 0, 60)), 2)
    internal_total = float(input_data["internal_total"])
    estimated_overall_marks = round(internal_total + predicted_semester_marks, 2)
    category = get_performance_category(estimated_overall_marks)

    return {
        "predicted_semester_marks": predicted_semester_marks,
        "estimated_overall_marks": estimated_overall_marks,
        "performance_category": category,
        "explanation": (
            f"Estimated overall marks are {estimated_overall_marks:.2f}/100: "
            f"{internal_total:.2f}/40 actual internal marks plus "
            f"{predicted_semester_marks:.2f}/60 predicted examination marks."
        ),
        "suggestions": get_suggestions(predicted_semester_marks, input_data),
        "feature_importance": _model_info.get("feature_importance", {}),
        "prediction_type": "ml_prediction",
        "model_version": _model_info.get("model_version"),
    }


def get_model_info():
    if _model_info:
        return _model_info
    try:
        with open(INFO_PATH, encoding="utf-8") as file:
            info = json.load(file)
        if info.get("training_status") == "trained" and MODEL_LOAD_ERROR:
            return {
                **info,
                "training_status": "needs_real_data",
                "status_message": MODEL_NOT_TRAINED_MESSAGE,
                "model_name": None,
                "model_version": None,
                "metrics": None,
                "algorithm_comparison": {},
                "feature_importance": {},
                "dataset_note": f"{MODEL_LOAD_ERROR} A rule-based estimate is used until a compatible genuine model is available.",
            }
        return info
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "training_status": "needs_real_data",
            "status_message": MODEL_NOT_TRAINED_MESSAGE,
            "features": [],
            "target": "actual_semester_marks",
            "dataset_size": 0,
            "metrics": None,
            "feature_importance": {},
            "dataset_note": MODEL_LOAD_ERROR or (
                "No historical dataset with actual end-semester marks is available. "
                "No model has been trained and metrics are unavailable."
            ),
            "algorithm_comparison": {},
            "data_quality": {},
        }
