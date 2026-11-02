"""Admin-only CSV import, EDA, and model-training endpoints."""

import hashlib
import io
import os
from pathlib import Path

import pandas as pd
from flask import Blueprint, g, jsonify, request, send_file
from mysql.connector import IntegrityError

from auth_utils import admin_required
from database import get_db_connection
from ml import predict as prediction_model
from ml.train_model import (
    InsufficientTrainingDataError,
    build_eda_summary,
    data_quality_report,
    load_database_data,
    prepare_training_data,
    train_and_save,
)


model_training_bp = Blueprint("model_training", __name__)
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE_PATH = os.path.join(BACKEND_DIR, "ml", "historical_marks_template.csv")
MAX_ROWS = 20000
REQUIRED_COLUMNS = {
    "attendance_pct",
    "assignment_1_marks",
    "assignment_2_marks",
    "class_test_1_marks",
    "class_test_2_marks",
    "presentation_marks",
    "actual_semester_marks",
}


def _training_data_status():
    source = load_database_data()
    if source.empty:
        return source, None, {}
    prepared, features = prepare_training_data(source)
    return prepared, features, data_quality_report(prepared, features)


def _insufficient_training_response(detail, record_count):
    if prediction_model.MODEL_READY:
        return jsonify({
            "error": "Insufficient new data; the existing trained model remains active.",
            "detail": detail,
            "training_status": "trained",
            "model": prediction_model.get_model_info(),
        }), 409

    from ml.train_model import _write_untrained_info

    _write_untrained_info(detail, dataset_size=record_count)
    return jsonify({
        "error": "Model Not Trained – Genuine Historical Examination Data Required.",
        "detail": detail,
        "training_status": "needs_real_data",
        "model": prediction_model.get_model_info(),
    }), 409


@model_training_bp.route("/model-training/template", methods=["GET"])
@admin_required
def download_template():
    return send_file(
        TEMPLATE_PATH,
        mimetype="text/csv",
        as_attachment=True,
        download_name="historical_marks_template.csv",
    )


@model_training_bp.route("/model-training/records", methods=["GET"])
@admin_required
def training_records_status():
    try:
        data, _, quality = _training_data_status()
        return jsonify({
            "record_count": int(len(data)),
            "minimum_records": 10,
            "data_quality": quality,
            "status_message": (
                "Genuine labeled records are ready for model evaluation."
                if len(data) >= 10 else
                "Model Not Trained – Genuine Historical Examination Data Required."
            ),
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@model_training_bp.route("/model-training/eda", methods=["GET"])
@admin_required
def training_eda():
    try:
        data, features, quality = _training_data_status()
        return jsonify({
            "record_count": int(len(data)),
            "data_quality": quality,
            "eda": build_eda_summary(data, features) if len(data) else None,
        }), 200
    except Exception as error:
        return jsonify({"error": str(error)}), 500


@model_training_bp.route("/model-training/upload", methods=["POST"])
@admin_required
def upload_training_records():
    uploaded_file = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"error": "Choose a historical CSV file to upload."}), 400
    if Path(uploaded_file.filename).suffix.lower() != ".csv":
        return jsonify({"error": "Only CSV dataset files are supported."}), 400

    content = uploaded_file.read()
    if not content:
        return jsonify({"error": "The uploaded CSV is empty."}), 400
    if len(content) > 10 * 1024 * 1024:
        return jsonify({"error": "The CSV exceeds the 10 MB upload limit."}), 413
    try:
        source = pd.read_csv(io.BytesIO(content), dtype=object)
    except (UnicodeDecodeError, pd.errors.ParserError, pd.errors.EmptyDataError) as error:
        return jsonify({"error": f"Unable to read CSV: {error}"}), 400

    missing_columns = sorted(REQUIRED_COLUMNS - set(source.columns))
    if missing_columns:
        return jsonify({
            "error": f"CSV is missing required columns: {', '.join(missing_columns)}."
        }), 400
    if len(source.columns) > len(REQUIRED_COLUMNS) + 1 or (
        set(source.columns) - REQUIRED_COLUMNS - {"previous_semester_marks"}
    ):
        return jsonify({"error": "CSV contains unsupported columns."}), 400
    if source.empty:
        return jsonify({"error": "CSV must contain genuine labeled student records."}), 400
    if len(source) > MAX_ROWS:
        return jsonify({"error": f"CSV may contain at most {MAX_ROWS} records."}), 413

    try:
        prepared, features = prepare_training_data(source)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    quality = data_quality_report(prepared, features)
    file_hash = hashlib.sha256(content).hexdigest()
    source_name = Path(uploaded_file.filename.replace("\\", "/")).name[:255]

    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM ml_training_records WHERE import_sha256 = %s LIMIT 1",
            (file_hash,),
        )
        if cursor.fetchone():
            return jsonify({"error": "This exact CSV file has already been imported."}), 409

        rows = []
        for offset, row in enumerate(prepared.to_dict(orient="records"), start=2):
            previous_marks = row.get("previous_semester_marks")
            rows.append((
                file_hash,
                offset,
                source_name,
                float(row["attendance_pct"]),
                float(row["assignment_1_marks"]),
                float(row["assignment_2_marks"]),
                float(row["class_test_1_marks"]),
                float(row["class_test_2_marks"]),
                float(row["presentation_marks"]),
                None if pd.isna(previous_marks) else float(previous_marks),
                float(row["actual_semester_marks"]),
                g.current_user["id"],
            ))
        cursor.executemany(
            """INSERT INTO ml_training_records
               (import_sha256, source_row_number, source_filename, attendance_pct,
                assignment_1_marks, assignment_2_marks, class_test_1_marks,
                class_test_2_marks, presentation_marks, previous_semester_marks,
                actual_semester_marks, imported_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            rows,
        )
        conn.commit()
        return jsonify({
            "message": f"Imported {len(rows)} genuine labeled record(s).",
            "imported_records": len(rows),
            "duplicate_rows_detected": quality["duplicate_rows"],
            "data_quality": quality,
            "training_status": (
                "ready" if len(rows) >= 10 else "insufficient_records"
            ),
            "status_message": (
                "Genuine records imported. At least 10 records are required for an 80:20 evaluation."
                if len(rows) < 10 else
                "Genuine records imported and ready for model training."
            ),
        }), 201
    except IntegrityError:
        if conn:
            conn.rollback()
        return jsonify({"error": "This CSV import conflicts with an existing dataset batch."}), 409
    except Exception as error:
        if conn:
            conn.rollback()
        return jsonify({"error": str(error)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@model_training_bp.route("/model-training/train", methods=["POST"])
@admin_required
def train_model():
    try:
        source = load_database_data()
        if source.empty:
            return _insufficient_training_response(
                "No genuine historical examination records with complete actual marks are available.",
                0,
            )
        info = train_and_save(source, "MySQL genuine CSV imports and actual examination results")
    except InsufficientTrainingDataError as error:
        return _insufficient_training_response(str(error), len(source))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return jsonify({"error": str(error)}), 500

    prediction_model.load_model()
    return jsonify({
        "message": "Model training and held-out evaluation completed using genuine records.",
        "model": info,
    }), 200
