"""Focused integrity checks for Gradiq's 40/60 assessment workflow."""

import os
import re
import sys
import unittest
from unittest.mock import patch

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from ml.predict import MODEL_READY, _compatible_model, get_model_info, predict
from routes.predictions import _validated_inputs
from routes.predictions import _build_result
from student_codes import STUDENT_CODE_PATTERN
from ml.train_model import (
    BASE_FEATURES,
    InsufficientTrainingDataError,
    build_eda_summary,
    data_quality_report,
    prepare_training_data,
    train,
)


class CodeCursor:
    def __init__(self):
        self.last_number = 0

    def execute(self, query, params):
        if query.startswith("SELECT last_number"):
            self.result = {"last_number": self.last_number}
        elif query.startswith("UPDATE student_code_sequences"):
            self.last_number = params[0]

    def fetchone(self):
        return self.result


class AcademicWorkflowTests(unittest.TestCase):
    def test_internal_mark_formula_and_ceiling(self):
        _, values = _validated_inputs({
            "student_code": "GRD-2026-0001",
            "attendance_pct": 100,
            "assignment_1_marks": 5,
            "assignment_2_marks": 5,
            "class_test_1_marks": 20,
            "class_test_2_marks": 20,
            "presentation_marks": 10,
        })
        self.assertEqual(values["combined_class_test_marks"], 20)
        self.assertEqual(values["internal_total"], 40)

        _, partial = _validated_inputs({
            "student_code": "GRD-2026-0001",
            "attendance_pct": 75,
            "assignment_1_marks": 3,
            "assignment_2_marks": 4,
            "class_test_1_marks": 10,
            "class_test_2_marks": 20,
            "presentation_marks": 8,
        })
        self.assertEqual(partial["combined_class_test_marks"], 15)
        self.assertEqual(partial["internal_total"], 30)

    def test_fractional_class_tests_round_consistently_to_database_precision(self):
        _, values = _validated_inputs({
            "student_code": "GRD-2026-0001",
            "attendance_pct": 80,
            "assignment_1_marks": 5,
            "assignment_2_marks": 5,
            "class_test_1_marks": 10.01,
            "class_test_2_marks": 10.02,
            "presentation_marks": 10,
        })
        self.assertEqual(values["combined_class_test_marks"], 10.02)
        self.assertEqual(values["internal_total"], 30.02)

    def test_required_range_and_code_validation(self):
        base = {
            "student_code": "GRD-2026-0001",
            "attendance_pct": 75,
            "assignment_1_marks": 3,
            "assignment_2_marks": 4,
            "class_test_1_marks": 10,
            "class_test_2_marks": 20,
            "presentation_marks": 8,
        }
        for field, value in (
            ("attendance_pct", -1),
            ("assignment_1_marks", 6),
            ("class_test_2_marks", 21),
            ("presentation_marks", -0.1),
        ):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    _validated_inputs({**base, field: value})
        with self.assertRaisesRegex(ValueError, "required"):
            _validated_inputs({key: value for key, value in base.items() if key != "class_test_1_marks"})
        with self.assertRaisesRegex(ValueError, "Student Code"):
            _validated_inputs({**base, "student_code": "STU-001"})
        with self.assertRaisesRegex(ValueError, "Unsupported prediction input"):
            _validated_inputs({**base, "daily_study_hours": 4})
        with self.assertRaisesRegex(ValueError, "Previous semester marks"):
            _validated_inputs({**base, "previous_semester_marks": 101})

    def test_sequential_code_generation_and_format(self):
        from student_codes import generate_student_code

        cursor = CodeCursor()
        self.assertEqual(generate_student_code(cursor, 2026), "GRD-2026-0001")
        self.assertEqual(generate_student_code(cursor, 2026), "GRD-2026-0002")
        self.assertTrue(STUDENT_CODE_PATTERN.fullmatch("GRD-2026-0001"))
        self.assertFalse(STUDENT_CODE_PATTERN.fullmatch("GRD-26-0001"))
        self.assertFalse(STUDENT_CODE_PATTERN.fullmatch("GRD-2026-001"))

    def test_legacy_synthetic_model_is_not_active_or_reported(self):
        self.assertFalse(MODEL_READY)
        info = get_model_info()
        self.assertEqual(info["target"], "actual_semester_marks")
        self.assertIsNone(info["metrics"])
        self.assertEqual(info["features"], BASE_FEATURES)
        self.assertEqual(
            info["status_message"],
            "Model Not Trained – Genuine Historical Examination Data Required.",
        )
        self.assertNotIn("daily_study_hours", info["features"])
        with self.assertRaisesRegex(RuntimeError, "genuine examination records"):
            predict({
                "attendance_pct": 80,
                "internal_total": 30,
            })

    def test_prediction_output_is_clamped_to_sixty(self):
        class FixedModel:
            def __init__(self, value):
                self.value = value

            def predict(self, _features):
                return [self.value]

        input_data = {
            "attendance_pct": 90,
            "assignment_1_marks": 5,
            "assignment_2_marks": 5,
            "combined_class_test_marks": 20,
            "presentation_marks": 10,
            "internal_total": 40,
        }
        feature_info = {"features": list(input_data), "feature_importance": {}}
        with patch("ml.predict.MODEL_READY", True), patch("ml.predict._model_info", feature_info):
            with patch("ml.predict._model", FixedModel(100)):
                high = predict(input_data)
            with patch("ml.predict._model", FixedModel(-10)):
                low = predict(input_data)
        self.assertEqual(high["predicted_semester_marks"], 60)
        self.assertEqual(high["estimated_overall_marks"], 100)
        self.assertEqual(low["predicted_semester_marks"], 0)
        self.assertEqual(low["estimated_overall_marks"], 40)

    def test_incompatible_model_metadata_is_rejected(self):
        class CompatibleModel:
            feature_names_in_ = [
                "attendance_pct",
                "assignment_1_marks",
                "assignment_2_marks",
                "class_test_1_marks",
                "class_test_2_marks",
                "combined_class_test_marks",
                "presentation_marks",
                "internal_total",
            ]

            def predict(self, _features):
                return [30]

        valid_info = {
            "features": list(CompatibleModel.feature_names_in_),
            "target": "actual_semester_marks",
            "dataset_size": 10,
            "test_size": 2,
            "metrics": {"mae": 1, "mse": 1, "rmse": 1, "r2": 0.5},
        }
        compatible, reason = _compatible_model(CompatibleModel(), valid_info)
        self.assertTrue(compatible, reason)

        invalid_info = {
            **valid_info,
            "features": ["daily_study_hours"],
        }
        compatible, reason = _compatible_model(CompatibleModel(), invalid_info)
        self.assertFalse(compatible)
        self.assertIn("feature names", reason)

    def test_failed_ml_inference_uses_explicit_rule_based_fallback(self):
        from unittest.mock import Mock

        values = {
            "attendance_pct": 85,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 16,
            "class_test_2_marks": 12,
            "combined_class_test_marks": 14,
            "presentation_marks": 5,
            "internal_total": 28,
        }
        with patch("routes.predictions.prediction_model.MODEL_READY", True):
            with patch("routes.predictions.prediction_model.predict", side_effect=ValueError("incompatible artifact")):
                with create_app().app_context():
                    result = _build_result(values)
        self.assertEqual(result["prediction_type"], "rule_based_estimate")
        self.assertEqual(result["predicted_semester_marks"], 44)
        self.assertEqual(result["estimated_overall_marks"], 72)
        self.assertIn("rule-based estimate", result["model_fallback_reason"])

    def test_rule_based_fallback_uses_formula_and_is_not_labeled_as_ml(self):
        code, values = _validated_inputs({
            "student_code": "GRD-2026-0001",
            "attendance_pct": 85,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 16,
            "class_test_2_marks": 12,
            "presentation_marks": 5,
        })
        self.assertEqual(code, "GRD-2026-0001")
        self.assertEqual(values["combined_class_test_marks"], 14)
        self.assertEqual(values["internal_total"], 28)
        with patch("routes.predictions.prediction_model.MODEL_READY", False):
            result = _build_result(values)
        self.assertEqual(result["predicted_semester_marks"], 44)
        self.assertEqual(result["estimated_overall_marks"], 72)
        self.assertEqual(result["prediction_type"], "rule_based_estimate")
        self.assertIsNone(result["model_version"])
        self.assertIn("Not ML Prediction", result["disclaimer"])

    def test_schema_has_new_marks_and_no_active_study_hours_column(self):
        root = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(root, "database", "database.sql"), encoding="utf-8") as file:
            schema = file.read()
        predictions_schema = schema.split("CREATE TABLE IF NOT EXISTS predictions", 1)[1]
        for column in (
            "attendance_pct", "assignment_1_marks", "assignment_2_marks",
            "class_test_1_marks", "class_test_2_marks", "combined_class_test_marks",
            "presentation_marks", "internal_total", "previous_semester_marks",
            "predicted_semester_marks", "estimated_overall_marks",
            "prediction_type",
            "model_version",
        ):
            self.assertIn(column, predictions_schema)
        self.assertIn("'rule_based_estimate'", predictions_schema)
        self.assertNotIn("daily_study_hours", predictions_schema)

    def test_api_routes_and_authentication_guards(self):
        client = create_app().test_client()
        self.assertEqual(client.get("/api/health").status_code, 200)
        self.assertEqual(client.get("/api/dashboard").status_code, 401)
        self.assertEqual(client.get("/api/student/dashboard").status_code, 401)
        self.assertEqual(client.post("/api/predict", json={}).status_code, 401)
        self.assertEqual(client.post("/api/model-training/train").status_code, 401)
        self.assertEqual(client.post("/api/model-training/upload").status_code, 401)


class ModelDatasetTests(unittest.TestCase):
    def test_components_are_derived_once_using_the_college_formula(self):
        source = pd.DataFrame([{
            "attendance_pct": 88,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 14,
            "class_test_2_marks": 18,
            "presentation_marks": 9,
            "actual_semester_marks": 52,
        }])
        prepared, features = prepare_training_data(source)
        self.assertEqual(prepared.loc[0, "combined_class_test_marks"], 16)
        self.assertEqual(prepared.loc[0, "internal_total"], 34)
        self.assertEqual(features, BASE_FEATURES)
        self.assertEqual(prepared.loc[0, "actual_semester_marks"], 52)

    def test_training_dataset_rejects_missing_invalid_or_inconsistent_inputs(self):
        source = pd.DataFrame([{
            "attendance_pct": 88,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 14,
            "class_test_2_marks": 18,
            "presentation_marks": 9,
            "actual_semester_marks": 52,
        }])
        for field, value in (
            ("attendance_pct", 101),
            ("assignment_1_marks", -1),
            ("class_test_1_marks", 21),
            ("presentation_marks", 11),
            ("actual_semester_marks", 61),
        ):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    prepare_training_data(source.assign(**{field: value}))
        with self.assertRaisesRegex(ValueError, "is required"):
            prepare_training_data(source.assign(actual_semester_marks=None))
        with self.assertRaisesRegex(ValueError, "Unsupported training CSV column"):
            prepare_training_data(source.assign(daily_study_hours=2))

    def test_previous_marks_are_only_a_feature_when_complete_and_valid(self):
        source = pd.DataFrame([{
            "attendance_pct": 88,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 14,
            "class_test_2_marks": 18,
            "presentation_marks": 9,
            "actual_semester_marks": 52,
            "previous_semester_marks": None,
        }])
        _, features = prepare_training_data(source)
        self.assertNotIn("previous_semester_marks", features)
        with self.assertRaisesRegex(ValueError, "between 0 and 100"):
            prepare_training_data(source.assign(previous_semester_marks=101))

    def test_eda_is_derived_from_actual_labeled_records(self):
        source = pd.DataFrame([{
            "attendance_pct": 88,
            "assignment_1_marks": 4,
            "assignment_2_marks": 5,
            "class_test_1_marks": 14,
            "class_test_2_marks": 18,
            "presentation_marks": 9,
            "actual_semester_marks": 52,
        }])
        prepared, features = prepare_training_data(source)
        eda = build_eda_summary(prepared, features)
        self.assertEqual(eda["record_count"], 1)
        self.assertEqual(len(eda["distributions"]["attendance_pct"]), 10)
        self.assertIn("attendance_pct", eda["relationships"])
        quality = data_quality_report(prepared, features)
        self.assertEqual(quality["duplicate_rows"], 0)

    def test_training_refuses_an_insufficient_dataset_without_fitting(self):
        with self.assertRaises(InsufficientTrainingDataError):
            train(pd.DataFrame(), BASE_FEATURES)

    def test_csv_template_has_headers_only_and_no_sample_marks(self):
        root = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(root, "ml", "historical_marks_template.csv")
        template = pd.read_csv(path)
        self.assertEqual(len(template), 0)
        self.assertEqual(set(template.columns), {
            "attendance_pct",
            "assignment_1_marks",
            "assignment_2_marks",
            "class_test_1_marks",
            "class_test_2_marks",
            "presentation_marks",
            "actual_semester_marks",
            "previous_semester_marks",
        })


if __name__ == "__main__":
    unittest.main(verbosity=2)
