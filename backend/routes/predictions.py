"""Admin-only prediction and prediction-history endpoints."""

import math
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import mysql.connector
from flask import Blueprint, current_app, jsonify, request

from auth_utils import admin_required
from database import get_db_connection
from ml import predict as prediction_model
from student_codes import STUDENT_CODE_PATTERN


predictions_bp = Blueprint("predictions", __name__)
MAX_PREVIOUS_SEMESTER_MARKS = 100
MARK_FIELDS = {
    "attendance_pct": (0, 100),
    "assignment_1_marks": (0, 5),
    "assignment_2_marks": (0, 5),
    "class_test_1_marks": (0, 20),
    "class_test_2_marks": (0, 20),
    "presentation_marks": (0, 10),
}
PREDICTION_COLUMNS = (
    "id, student_id, attendance_pct, assignment_1_marks, assignment_2_marks, "
    "class_test_1_marks, class_test_2_marks, combined_class_test_marks, "
    "presentation_marks, internal_total, previous_semester_marks, "
    "predicted_semester_marks, estimated_overall_marks, actual_semester_marks, "
    "performance_category, prediction_type, model_version, created_at"
)


def _validated_inputs(data):
    allowed_fields = set(MARK_FIELDS) | {"student_code", "previous_semester_marks"}
    unsupported_fields = set(data) - allowed_fields
    if unsupported_fields:
        raise ValueError(f"Unsupported prediction input field(s): {', '.join(sorted(unsupported_fields))}.")
    code = str(data.get("student_code", "")).strip()
    if not STUDENT_CODE_PATTERN.fullmatch(code):
        raise ValueError("Select a valid Student Code in GRD-YYYY-NNNN format.")

    values = {}
    for field, (minimum, maximum) in MARK_FIELDS.items():
        raw = data.get(field)
        if raw is None or str(raw).strip() == "":
            raise ValueError(f"{field.replace('_', ' ').capitalize()} is required.")
        try:
            decimal_value = Decimal(str(raw))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError(f"{field.replace('_', ' ').capitalize()} must be a valid number.")
        if not decimal_value.is_finite() or not Decimal(str(minimum)) <= decimal_value <= Decimal(str(maximum)):
            raise ValueError(f"{field.replace('_', ' ').capitalize()} must be between {minimum} and {maximum}.")
        normalized = decimal_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if normalized != decimal_value:
            raise ValueError(f"{field.replace('_', ' ').capitalize()} may have at most 2 decimal places.")
        values[field] = float(normalized)

    previous_raw = data.get("previous_semester_marks")
    if previous_raw is None or str(previous_raw).strip() == "":
        values["previous_semester_marks"] = None
    else:
        try:
            previous_decimal = Decimal(str(previous_raw))
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Previous semester marks must be a valid number.")
        if (
            not previous_decimal.is_finite()
            or not Decimal("0") <= previous_decimal <= Decimal(str(MAX_PREVIOUS_SEMESTER_MARKS))
        ):
            raise ValueError(
                f"Previous semester marks must be between 0 and {MAX_PREVIOUS_SEMESTER_MARKS}."
            )
        normalized_previous = previous_decimal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if normalized_previous != previous_decimal:
            raise ValueError("Previous semester marks may have at most 2 decimal places.")
        values["previous_semester_marks"] = float(normalized_previous)

    combined_tests = (
        Decimal(str(values["class_test_1_marks"]))
        + Decimal(str(values["class_test_2_marks"]))
    ) / 2
    combined_tests = combined_tests.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    values["combined_class_test_marks"] = float(combined_tests)
    values["internal_total"] = float(
        Decimal(str(values["assignment_1_marks"]))
        + Decimal(str(values["assignment_2_marks"]))
        + combined_tests
        + Decimal(str(values["presentation_marks"]))
    )
    return code, values


def _serialize(row):
    if not row:
        return row
    if row.get("created_at"):
        row["created_at"] = row["created_at"].isoformat()
    numeric_fields = (
        "attendance_pct", "assignment_1_marks", "assignment_2_marks",
        "class_test_1_marks", "class_test_2_marks", "combined_class_test_marks",
        "presentation_marks", "internal_total", "previous_semester_marks",
        "predicted_semester_marks", "estimated_overall_marks", "actual_semester_marks",
    )
    for key in numeric_fields:
        if key in row and row[key] is not None:
            row[key] = float(row[key])
    return row


def _find_student(cursor, code):
    cursor.execute(
        """SELECT id, student_id, full_name, email, course, semester
           FROM students WHERE student_id = %s""",
        (code,),
    )
    return cursor.fetchone()


def _save_prediction(cursor, student, values, result, prediction_id=None):
    prediction_values = result or {
        "predicted_semester_marks": None,
        "estimated_overall_marks": None,
        "performance_category": None,
        "prediction_type": "pending",
        "model_version": None,
    }
    params = (
        values["attendance_pct"],
        values["assignment_1_marks"],
        values["assignment_2_marks"],
        values["class_test_1_marks"],
        values["class_test_2_marks"],
        values["combined_class_test_marks"],
        values["presentation_marks"],
        values["internal_total"],
        values["previous_semester_marks"],
        prediction_values["predicted_semester_marks"],
        prediction_values["estimated_overall_marks"],
        prediction_values["performance_category"],
        prediction_values["prediction_type"],
        prediction_values["model_version"],
    )
    if prediction_id is None:
        cursor.execute(
            """INSERT INTO predictions
               (student_id, attendance_pct, assignment_1_marks, assignment_2_marks,
                class_test_1_marks, class_test_2_marks, combined_class_test_marks,
                presentation_marks, internal_total, previous_semester_marks,
                predicted_semester_marks, estimated_overall_marks, performance_category,
                prediction_type, model_version)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (student["id"],) + params,
        )
        return cursor.lastrowid
    cursor.execute(
        """UPDATE predictions SET attendance_pct = %s, assignment_1_marks = %s,
               assignment_2_marks = %s, class_test_1_marks = %s, class_test_2_marks = %s,
               combined_class_test_marks = %s, presentation_marks = %s,
               internal_total = %s, previous_semester_marks = %s,
               predicted_semester_marks = %s, estimated_overall_marks = %s,
               performance_category = %s, prediction_type = %s, model_version = %s
           WHERE id = %s AND student_id = %s""",
        params + (prediction_id, student["id"]),
    )
    return prediction_id


def _build_result(values):
    if not prediction_model.MODEL_READY:
        return prediction_model.estimate_end_semester(values)
    try:
        return prediction_model.predict(values)
    except Exception:
        current_app.logger.exception(
            "The trained model failed during prediction; returning the provisional estimate."
        )
        result = prediction_model.estimate_end_semester(values)
        result["model_fallback_reason"] = (
            "The trained model could not process this assessment; this result is a rule-based estimate."
        )
        return result


def _rollback(conn):
    if conn:
        try:
            conn.rollback()
        except mysql.connector.Error:
            current_app.logger.exception("Failed to roll back the prediction database transaction.")


@predictions_bp.route("/predict", methods=["POST"])
@admin_required
def make_prediction():
    data = request.get_json(silent=True) or {}
    try:
        code, values = _validated_inputs(data)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        student = _find_student(cursor, code)
        if not student:
            return jsonify({"error": "Student not found. Select an enrolled student."}), 404
        result = _build_result(values)
        prediction_id = _save_prediction(cursor, student, values, result)
        conn.commit()
        return jsonify({
            "prediction_id": prediction_id,
            "prediction_available": True,
            "prediction_status": "generated",
            "student": {
                "id": student["id"],
                "student_code": student["student_id"],
                "full_name": student["full_name"],
                "course": student["course"],
                "semester": student["semester"],
            },
            **result,
            "internal_total": values["internal_total"],
            "combined_class_test_marks": values["combined_class_test_marks"],
            "assignment_1_marks": values["assignment_1_marks"],
            "assignment_2_marks": values["assignment_2_marks"],
            "class_test_1_marks": values["class_test_1_marks"],
            "class_test_2_marks": values["class_test_2_marks"],
            "presentation_marks": values["presentation_marks"],
            "suggestions": result["suggestions"],
            "attendance_pct": values["attendance_pct"],
            "disclaimer": result["disclaimer"] if result["prediction_type"] == "rule_based_estimate"
                else "ML-predicted end-semester marks are an estimate; internal marks are actual recorded assessment marks.",
        }), 201
    except mysql.connector.Error:
        _rollback(conn)
        current_app.logger.exception("Database failure while generating or saving a prediction.")
        return jsonify({"error": "The prediction could not be saved because the database is unavailable."}), 503
    except Exception:
        _rollback(conn)
        current_app.logger.exception("Unexpected failure while generating or saving a prediction.")
        return jsonify({"error": "The prediction could not be generated. Please try again."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@predictions_bp.route("/predictions", methods=["GET"])
@admin_required
def get_predictions():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""SELECT p.{PREDICTION_COLUMNS.replace(', ', ', p.')},
                       s.full_name AS student_name, s.student_id AS student_code,
                       s.course, s.semester
                FROM predictions p JOIN students s ON p.student_id = s.id
                ORDER BY p.created_at DESC, p.id DESC"""
        )
        rows = [_serialize(row) for row in cursor.fetchall()]
        return jsonify({"predictions": rows, "total": len(rows)}), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@predictions_bp.route("/predictions/<int:pred_id>", methods=["GET"])
@admin_required
def get_prediction(pred_id):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            f"""SELECT p.{PREDICTION_COLUMNS.replace(', ', ', p.')},
                       s.full_name AS student_name, s.student_id AS student_code,
                       s.course, s.semester, s.email AS student_email
                FROM predictions p JOIN students s ON p.student_id = s.id
                WHERE p.id = %s""",
            (pred_id,),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Prediction record not found"}), 404
        return jsonify({"prediction": _serialize(row)}), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@predictions_bp.route("/predictions/<int:pred_id>", methods=["PUT"])
@admin_required
def update_prediction(pred_id):
    data = request.get_json(silent=True) or {}
    try:
        code, values = _validated_inputs(data)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT student_id FROM predictions WHERE id = %s", (pred_id,))
        existing = cursor.fetchone()
        if not existing:
            return jsonify({"error": "Prediction record not found"}), 404
        student = _find_student(cursor, code)
        if not student or student["id"] != existing["student_id"]:
            return jsonify({"error": "The prediction's student cannot be changed."}), 400
        result = _build_result(values)
        _save_prediction(cursor, student, values, result, pred_id)
        conn.commit()
        return jsonify({
            "message": "Academic marks and estimate updated.",
            "prediction_available": True,
            "prediction_status": "generated",
            "internal_total": values["internal_total"],
            **result,
        }), 200
    except mysql.connector.Error:
        _rollback(conn)
        current_app.logger.exception("Database failure while updating a prediction.")
        return jsonify({"error": "The prediction could not be saved because the database is unavailable."}), 503
    except Exception:
        _rollback(conn)
        current_app.logger.exception("Unexpected failure while updating a prediction.")
        return jsonify({"error": "The prediction could not be updated. Please try again."}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@predictions_bp.route("/predictions/<int:pred_id>/actual-result", methods=["PUT"])
@admin_required
def record_actual_semester_result(pred_id):
    data = request.get_json(silent=True) or {}
    raw_marks = data.get("actual_semester_marks")
    try:
        actual_marks = float(raw_marks)
    except (TypeError, ValueError):
        return jsonify({"error": "Actual end-semester marks are required as a number."}), 400
    if not math.isfinite(actual_marks) or not 0 <= actual_marks <= 60:
        return jsonify({"error": "Actual end-semester marks must be between 0 and 60."}), 400

    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE predictions SET actual_semester_marks = %s WHERE id = %s",
            (actual_marks, pred_id),
        )
        if cursor.rowcount == 0:
            cursor.execute("SELECT id FROM predictions WHERE id = %s", (pred_id,))
            if not cursor.fetchone():
                return jsonify({"error": "Prediction record not found"}), 404
        conn.commit()
        return jsonify({"message": "Actual end-semester result recorded."}), 200
    except Exception as error:
        if conn:
            conn.rollback()
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@predictions_bp.route("/predictions/<int:pred_id>", methods=["DELETE"])
@admin_required
def delete_prediction(pred_id):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM predictions WHERE id = %s", (pred_id,))
        if cursor.rowcount == 0:
            return jsonify({"error": "Prediction record not found"}), 404
        conn.commit()
        return jsonify({"message": "Prediction deleted successfully"}), 200
    except Exception as error:
        if conn:
            conn.rollback()
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
