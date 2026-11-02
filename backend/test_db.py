"""Verify MySQL connectivity and the migrated Gradiq assessment schema."""

from database import get_db_connection


REQUIRED_PREDICTION_COLUMNS = {
    "attendance_pct",
    "assignment_1_marks",
    "assignment_2_marks",
    "class_test_1_marks",
    "class_test_2_marks",
    "combined_class_test_marks",
    "presentation_marks",
    "internal_total",
    "previous_semester_marks",
    "predicted_semester_marks",
    "estimated_overall_marks",
    "actual_semester_marks",
    "performance_category",
    "prediction_type",
    "model_version",
    "created_at",
}


def main():
    conn = get_db_connection()
    cursor = None
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SHOW TABLES")
        tables = [next(iter(row.values())) for row in cursor.fetchall()]
        print("MySQL connected.")
        print("Tables:", ", ".join(sorted(tables)))

        cursor.execute("SHOW COLUMNS FROM predictions")
        prediction_columns = {row["Field"] for row in cursor.fetchall()}
        missing = REQUIRED_PREDICTION_COLUMNS - prediction_columns
        if missing:
            raise RuntimeError(f"Database migration is incomplete; missing columns: {', '.join(sorted(missing))}")
        cursor.execute("SHOW TABLES LIKE 'ml_training_records'")
        if not cursor.fetchone():
            raise RuntimeError("Database migration is incomplete; missing table: ml_training_records")

        cursor.execute(
            """SELECT COUNT(*) AS prediction_records,
                      SUM(predicted_semester_marks IS NOT NULL) AS predictions_available,
                      SUM(actual_semester_marks IS NOT NULL) AS actual_exam_results
               FROM predictions"""
        )
        prediction_counts = cursor.fetchone()
        cursor.execute(
            """SELECT COUNT(*) AS student_records,
                      SUM(student_id REGEXP '^GRD-[0-9]{4}-[0-9]{4}$') AS valid_student_codes
               FROM students"""
        )
        student_counts = cursor.fetchone()
        print("Prediction counts:", prediction_counts)
        print("Student code counts:", student_counts)
        print("Assessment schema verification passed.")
    finally:
        if cursor:
            cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
