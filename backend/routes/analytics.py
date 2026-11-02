"""Admin-only analytics and model information endpoints."""

from flask import Blueprint, jsonify

from auth_utils import admin_required
from database import get_db_connection
from ml.predict import get_model_info


analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/analytics", methods=["GET"])
@admin_required
def get_analytics():
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT AVG(internal_total) AS average_internal_marks,
                      AVG(predicted_semester_marks) AS average_predicted_semester_marks,
                      AVG(estimated_overall_marks) AS average_estimated_overall_marks,
                      COUNT(*) AS prediction_count
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

        cursor.execute(
            """SELECT performance_category AS category, COUNT(*) AS count
               FROM predictions
               WHERE prediction_type = 'ml_prediction'
                 AND predicted_semester_marks IS NOT NULL
               GROUP BY performance_category"""
        )
        distribution = [{"category": row["category"], "count": row["count"]}
                        for row in cursor.fetchall()]

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

        cursor.execute(
            """SELECT s.course,
                      AVG(p.internal_total) AS average_internal_marks,
                      AVG(p.predicted_semester_marks) AS average_predicted_semester_marks,
                      AVG(p.estimated_overall_marks) AS average_estimated_overall_marks,
                      COUNT(*) AS count
               FROM predictions p JOIN students s ON p.student_id = s.id
               WHERE p.prediction_type = 'ml_prediction'
                 AND p.predicted_semester_marks IS NOT NULL
               GROUP BY s.course"""
        )
        course_averages = []
        for row in cursor.fetchall():
            course_averages.append({
                key: (round(float(row[key]), 2) if key.startswith("average_") else row[key])
                for key in (
                    "course", "average_internal_marks",
                    "average_predicted_semester_marks",
                    "average_estimated_overall_marks", "count",
                )
            })

        model_info = get_model_info()
        return jsonify({
            **summary,
            "performance_distribution": distribution,
            "attendance_vs_marks": attendance_vs_marks,
            "course_averages": course_averages,
            "feature_importance": model_info.get("feature_importance", {}),
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@analytics_bp.route("/model-info", methods=["GET"])
@admin_required
def model_info():
    return jsonify(get_model_info()), 200
