"""Student endpoints expose only records linked to the authenticated account."""

from flask import Blueprint, g, jsonify

from auth_utils import student_required
from database import get_db_connection
from ml.predict import get_suggestions
from routes.predictions import PREDICTION_COLUMNS


student_portal_bp = Blueprint("student_portal", __name__, url_prefix="/api/student")
NUMERIC_FIELDS = (
    "attendance_pct", "assignment_1_marks", "assignment_2_marks",
    "class_test_1_marks", "class_test_2_marks", "combined_class_test_marks",
    "presentation_marks", "internal_total", "previous_semester_marks",
    "predicted_semester_marks", "estimated_overall_marks", "actual_semester_marks",
)


def _serialize_student(row):
    if row:
        for key in ("created_at", "updated_at"):
            if row.get(key):
                row[key] = row[key].isoformat()
        for key in ("attendance", "previous_marks"):
            if row.get(key) is not None:
                row[key] = float(row[key])
    return row


def _serialize_prediction(row):
    if not row:
        return None
    if row.get("created_at"):
        row["created_at"] = row["created_at"].isoformat()
    for key in NUMERIC_FIELDS:
        if row.get(key) is not None:
            row[key] = float(row[key])
    row["suggestions"] = (
        get_suggestions(
            row["predicted_semester_marks"],
            {
                "attendance_pct": row.get("attendance_pct") or 0,
                "internal_total": row.get("internal_total") or 0,
            },
        )
        if row.get("prediction_type") == "ml_prediction"
        and row.get("predicted_semester_marks") is not None
        else []
    )
    return row


def _get_student_record(cursor, email):
    cursor.execute(
        """SELECT id, student_id, full_name, email, course, semester,
                  attendance, previous_marks, created_at, updated_at
           FROM students WHERE email = %s""",
        (email,),
    )
    return _serialize_student(cursor.fetchone())


def _prediction_select():
    return f"""SELECT p.{PREDICTION_COLUMNS.replace(', ', ', p.')},
                      s.full_name AS student_name, s.student_id AS student_code,
                      s.course, s.semester
               FROM predictions p JOIN students s ON p.student_id = s.id"""


def _student_or_404(cursor, email):
    student = _get_student_record(cursor, email)
    if not student:
        return None, (jsonify({"error": "No student profile is linked to this account. Contact an administrator."}), 404)
    return student, None


@student_portal_bp.route("/dashboard", methods=["GET"])
@student_required
def get_student_dashboard():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        student, error_response = _student_or_404(cursor, g.current_user["email"])
        if error_response:
            return error_response
        cursor.execute(
            _prediction_select() + " WHERE p.student_id = %s ORDER BY p.created_at DESC, p.id DESC",
            (student["id"],),
        )
        predictions = [_serialize_prediction(row) for row in cursor.fetchall()]
        return jsonify({
            "student": student,
            "latest_prediction": predictions[0] if predictions else None,
            "predictions": predictions,
            "total_predictions": len(predictions),
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@student_portal_bp.route("/profile", methods=["GET"])
@student_required
def get_student_profile():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        student, error_response = _student_or_404(cursor, g.current_user["email"])
        if error_response:
            return error_response
        return jsonify({"student": student}), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@student_portal_bp.route("/predictions", methods=["GET"])
@student_required
def get_student_predictions():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        student, error_response = _student_or_404(cursor, g.current_user["email"])
        if error_response:
            return error_response
        cursor.execute(
            _prediction_select() + " WHERE p.student_id = %s ORDER BY p.created_at DESC, p.id DESC",
            (student["id"],),
        )
        rows = [_serialize_prediction(row) for row in cursor.fetchall()]
        return jsonify({"predictions": rows, "total": len(rows), "student": student}), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@student_portal_bp.route("/predictions/<int:pred_id>", methods=["GET"])
@student_required
def get_student_single_prediction(pred_id):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        student, error_response = _student_or_404(cursor, g.current_user["email"])
        if error_response:
            return error_response
        cursor.execute(
            _prediction_select() + " WHERE p.id = %s AND p.student_id = %s",
            (pred_id, student["id"]),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "Prediction record not found or access denied."}), 404
        return jsonify({"prediction": _serialize_prediction(row)}), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
