"""Admin dashboard aggregates based on saved 40/60 prediction records."""

from flask import Blueprint, jsonify

from auth_utils import admin_required
from database import get_db_connection


dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/dashboard", methods=["GET"])
@admin_required
def get_dashboard():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) AS total_students FROM students")
        total_students = cursor.fetchone()["total_students"]

        cursor.execute(
            """SELECT COUNT(*) AS total_predictions,
                      AVG(internal_total) AS average_internal_marks,
                      AVG(predicted_semester_marks) AS average_predicted_semester_marks,
                      AVG(estimated_overall_marks) AS average_estimated_overall_marks,
                      SUM(estimated_overall_marks < 40) AS students_at_risk
               FROM predictions
               WHERE prediction_type = 'ml_prediction'
                 AND predicted_semester_marks IS NOT NULL"""
        )
        summary = cursor.fetchone()
        for key in (
            "average_internal_marks",
            "average_predicted_semester_marks",
            "average_estimated_overall_marks",
        ):
            summary[key] = round(float(summary[key]), 2) if summary[key] is not None else None
        summary["students_at_risk"] = int(summary["students_at_risk"] or 0)

        cursor.execute(
            """SELECT p.id, p.predicted_semester_marks, p.estimated_overall_marks,
                      p.internal_total, p.performance_category, p.created_at,
                      s.full_name AS student_name, s.student_id AS student_code
               FROM predictions p JOIN students s ON p.student_id = s.id
               WHERE p.prediction_type = 'ml_prediction'
                 AND p.predicted_semester_marks IS NOT NULL
               ORDER BY p.created_at DESC LIMIT 5"""
        )
        recent = []
        for row in cursor.fetchall():
            row["created_at"] = row["created_at"].isoformat() if row["created_at"] else None
            for key in ("predicted_semester_marks", "estimated_overall_marks", "internal_total"):
                row[key] = float(row[key])
            recent.append(row)

        cursor.execute(
            """SELECT performance_category AS category, COUNT(*) AS count
               FROM predictions
               WHERE prediction_type = 'ml_prediction'
                 AND predicted_semester_marks IS NOT NULL
               GROUP BY performance_category"""
        )
        distribution = {row["category"]: row["count"] for row in cursor.fetchall()}

        cursor.execute(
            """SELECT attendance_pct AS attendance,
                      predicted_semester_marks AS marks
               FROM predictions
               WHERE prediction_type = 'ml_prediction'
                 AND predicted_semester_marks IS NOT NULL
               ORDER BY created_at DESC LIMIT 100"""
        )
        attendance_vs_marks = [
            {"attendance": float(row["attendance"]), "marks": float(row["marks"])}
            for row in cursor.fetchall()
        ]
        return jsonify({
            "total_students": total_students,
            "total_predictions": summary["total_predictions"],
            "average_internal_marks": summary["average_internal_marks"],
            "average_predicted_semester_marks": summary["average_predicted_semester_marks"],
            "average_estimated_overall_marks": summary["average_estimated_overall_marks"],
            "students_at_risk": summary["students_at_risk"],
            "recent_predictions": recent,
            "marks_distribution": distribution,
            "attendance_vs_marks": attendance_vs_marks,
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
