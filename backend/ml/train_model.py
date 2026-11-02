"""Train Gradiq regression models only from genuine college examination records."""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.tree import DecisionTreeRegressor


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(SCRIPT_DIR, "saved_model")
MODEL_PATH = os.path.join(MODEL_DIR, "model.pkl")
INFO_PATH = os.path.join(MODEL_DIR, "model_info.json")

BASE_FEATURES = [
    "attendance_pct",
    "assignment_1_marks",
    "assignment_2_marks",
    "class_test_1_marks",
    "class_test_2_marks",
    "combined_class_test_marks",
    "presentation_marks",
    "internal_total",
]
REQUIRED_COLUMNS = [
    "attendance_pct",
    "assignment_1_marks",
    "assignment_2_marks",
    "class_test_1_marks",
    "class_test_2_marks",
    "presentation_marks",
    "actual_semester_marks",
]
OPTIONAL_COLUMNS = {"previous_semester_marks"}
TARGET = "actual_semester_marks"
RANGES = {
    "attendance_pct": (0, 100),
    "assignment_1_marks": (0, 5),
    "assignment_2_marks": (0, 5),
    "class_test_1_marks": (0, 20),
    "class_test_2_marks": (0, 20),
    "presentation_marks": (0, 10),
    TARGET: (0, 60),
    "previous_semester_marks": (0, 100),
}
UNTRAINED_STATUS = "Model Not Trained – Genuine Historical Examination Data Required."


class InsufficientTrainingDataError(ValueError):
    """Raised when genuine records cannot support a held-out model evaluation."""


def _write_untrained_info(note=None, dataset_size=0):
    os.makedirs(MODEL_DIR, exist_ok=True)
    info = {
        "training_status": "needs_real_data",
        "status_message": UNTRAINED_STATUS,
        "model_name": None,
        "model_version": None,
        "features": BASE_FEATURES,
        "target": TARGET,
        "dataset_size": dataset_size,
        "train_size": 0,
        "test_size": 0,
        "random_state": 42,
        "metrics": None,
        "algorithm_comparison": {},
        "feature_importance": {},
        "dataset_note": note or UNTRAINED_STATUS,
        "data_quality": {},
    }
    with open(INFO_PATH, "w", encoding="utf-8") as file:
        json.dump(info, file, indent=2, ensure_ascii=False)
    return info


def _existing_trained_model():
    if not os.path.isfile(MODEL_PATH) or not os.path.isfile(INFO_PATH):
        return False
    try:
        with open(INFO_PATH, encoding="utf-8") as file:
            return json.load(file).get("training_status") == "trained"
    except (OSError, json.JSONDecodeError):
        return False


def _check_numeric_precision(data, columns):
    for column in columns:
        for value in data[column].dropna():
            try:
                decimal_value = Decimal(str(value))
            except InvalidOperation as error:
                raise ValueError(f"{column} contains a non-numeric value.") from error
            if not decimal_value.is_finite():
                raise ValueError(f"{column} contains a non-finite value.")
            try:
                rounded = decimal_value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            except InvalidOperation as error:
                raise ValueError(f"{column} is outside the supported numeric range.") from error
            if rounded != decimal_value:
                raise ValueError(f"{column} may have at most 2 decimal places.")


def prepare_training_data(source):
    """Validate raw component data and derive the only legal combined/internal marks."""
    data = source.copy()
    missing_columns = sorted(set(REQUIRED_COLUMNS) - set(data.columns))
    if missing_columns:
        raise ValueError(f"Training CSV is missing required columns: {', '.join(missing_columns)}")
    unknown_columns = sorted(set(data.columns) - set(REQUIRED_COLUMNS) - OPTIONAL_COLUMNS)
    if unknown_columns:
        raise ValueError(f"Unsupported training CSV column(s): {', '.join(unknown_columns)}")

    required_features = [
        "attendance_pct", "assignment_1_marks", "assignment_2_marks",
        "class_test_1_marks", "class_test_2_marks", "presentation_marks", TARGET,
    ]
    for column in required_features:
        original = data[column]
        converted = pd.to_numeric(original, errors="coerce")
        invalid = converted.isna() & original.notna() & original.astype(str).str.strip().ne("")
        if invalid.any():
            row = int(np.flatnonzero(invalid.to_numpy())[0]) + 2
            raise ValueError(f"{column} contains a non-numeric value at CSV row {row}.")
        if converted.isna().any():
            row = int(np.flatnonzero(converted.isna().to_numpy())[0]) + 2
            raise ValueError(f"{column} is required; a value is missing at CSV row {row}.")
        data[column] = converted

    previous_available = False
    if "previous_semester_marks" in data.columns:
        original = data["previous_semester_marks"]
        converted = pd.to_numeric(original, errors="coerce")
        invalid = converted.isna() & original.notna() & original.astype(str).str.strip().ne("")
        if invalid.any():
            row = int(np.flatnonzero(invalid.to_numpy())[0]) + 2
            raise ValueError(f"previous_semester_marks contains a non-numeric value at CSV row {row}.")
        data["previous_semester_marks"] = converted
        previous_available = converted.notna().all()

    precision_columns = required_features + (
        ["previous_semester_marks"] if "previous_semester_marks" in data.columns else []
    )
    _check_numeric_precision(data, precision_columns)

    for column in required_features:
        minimum, maximum = RANGES[column]
        if not data[column].between(minimum, maximum).all():
            raise ValueError(f"{column} must be between {minimum} and {maximum}.")
    if "previous_semester_marks" in data.columns and not data["previous_semester_marks"].dropna().between(0, 100).all():
        raise ValueError("previous_semester_marks must be between 0 and 100.")

    combined_tests = []
    internal_totals = []
    for row in data.itertuples(index=False):
        values = row._asdict()
        ct_average = (
            Decimal(str(values["class_test_1_marks"]))
            + Decimal(str(values["class_test_2_marks"]))
        ) / 2
        ct_average = ct_average.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        combined_tests.append(float(ct_average))
        internal_totals.append(float(
            Decimal(str(values["assignment_1_marks"]))
            + Decimal(str(values["assignment_2_marks"]))
            + ct_average
            + Decimal(str(values["presentation_marks"]))
        ))
    data["combined_class_test_marks"] = combined_tests
    data["internal_total"] = internal_totals
    features = BASE_FEATURES + (["previous_semester_marks"] if previous_available else [])
    return data, features


def load_training_data(path):
    return prepare_training_data(pd.read_csv(path))


def load_database_data():
    """Load imported genuine records and complete predictions with actual exam labels."""
    sys.path.insert(0, os.path.dirname(SCRIPT_DIR))
    from database import get_db_connection

    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """SELECT attendance_pct, assignment_1_marks, assignment_2_marks,
                      class_test_1_marks, class_test_2_marks, presentation_marks,
                      previous_semester_marks, actual_semester_marks
               FROM ml_training_records
               UNION ALL
               SELECT attendance_pct, assignment_1_marks, assignment_2_marks,
                      class_test_1_marks, class_test_2_marks, presentation_marks,
                      previous_semester_marks, actual_semester_marks
               FROM predictions
               WHERE actual_semester_marks IS NOT NULL
                 AND attendance_pct IS NOT NULL
                 AND assignment_1_marks IS NOT NULL
                 AND assignment_2_marks IS NOT NULL
                 AND class_test_1_marks IS NOT NULL
                 AND class_test_2_marks IS NOT NULL
                 AND presentation_marks IS NOT NULL"""
        )
        return pd.DataFrame(cursor.fetchall())
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def data_quality_report(data, features):
    raw_columns = REQUIRED_COLUMNS + (
        ["previous_semester_marks"] if "previous_semester_marks" in data.columns else []
    )
    return {
        "missing_values": {
            column: int(data[column].isna().sum())
            for column in raw_columns
        },
        "duplicate_rows": int(data.duplicated(subset=raw_columns).sum()),
        "rows_after_validation": int(len(data)),
        "previous_semester_feature_included": "previous_semester_marks" in features,
    }


def build_eda_summary(data, features):
    """Return bounded, anonymized chart data derived only from actual labeled rows."""
    if data.empty:
        return None

    ranges = {"attendance_pct": 100, "internal_total": 40, TARGET: 60}
    distributions = {}
    for column, maximum in ranges.items():
        counts, edges = np.histogram(data[column].to_numpy(dtype=float), bins=10, range=(0, maximum))
        distributions[column] = [
            {
                "range": f"{edges[index]:g}–{edges[index + 1]:g}",
                "count": int(counts[index]),
            }
            for index in range(len(counts))
        ]

    sample = data.sample(min(120, len(data)), random_state=42)
    relationships = {
        feature: [
            {"x": round(float(row[feature]), 3), "y": round(float(row[TARGET]), 3)}
            for _, row in sample[[feature, TARGET]].iterrows()
        ]
        for feature in features
    }
    correlation_columns = list(features) + [TARGET]
    correlations = data[correlation_columns].corr().round(4).fillna(0).to_dict()
    return {
        "record_count": int(len(data)),
        "distributions": distributions,
        "relationships": relationships,
        "correlations": correlations,
    }


def _pipeline(regressor):
    return Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("regressor", regressor),
    ])


def _feature_importance(model, features):
    regressor = model.named_steps["regressor"]
    if hasattr(regressor, "feature_importances_"):
        values = np.asarray(regressor.feature_importances_, dtype=float)
    elif hasattr(regressor, "coef_"):
        values = np.abs(np.asarray(regressor.coef_, dtype=float))
    else:
        return {}
    total = float(values.sum())
    normalized = values / total if total else np.zeros_like(values)
    return {name: round(float(value), 4) for name, value in zip(features, normalized)}


def train(data, features):
    if len(data) < 10:
        raise InsufficientTrainingDataError(
            "At least 10 genuine historical exam records are required for an 80:20 evaluation split."
        )

    x_train, x_test, y_train, y_test = train_test_split(
        data[features], data[TARGET], test_size=0.2, random_state=42
    )
    candidates = {
        "Linear Regression": _pipeline(LinearRegression()),
        "Decision Tree Regressor": _pipeline(DecisionTreeRegressor(random_state=42)),
        "Random Forest Regressor": _pipeline(RandomForestRegressor(
            n_estimators=200, random_state=42, n_jobs=1,
        )),
    }
    results = {}
    fitted_models = {}
    for name, candidate in candidates.items():
        candidate.fit(x_train, y_train)
        test_predictions = np.clip(candidate.predict(x_test), 0, 60)
        mse = float(mean_squared_error(y_test, test_predictions))
        results[name] = {
            "mae": round(float(mean_absolute_error(y_test, test_predictions)), 4),
            "mse": round(mse, 4),
            "rmse": round(float(np.sqrt(mse)), 4),
            "r2": round(float(r2_score(y_test, test_predictions)), 4),
        }
        fitted_models[name] = candidate

    best_name = min(results, key=lambda name: (results[name]["rmse"], name))
    production_model = candidates[best_name]
    production_model.fit(data[features], data[TARGET])
    return {
        "model": production_model,
        "model_name": best_name,
        "metrics": results[best_name],
        "algorithm_comparison": results,
        "feature_importance": _feature_importance(production_model, features),
        "train_size": len(x_train),
        "test_size": len(x_test),
    }


def train_and_save(source, dataset_source):
    data, features = prepare_training_data(source)
    quality = data_quality_report(data, features)
    if len(data) < 10:
        raise InsufficientTrainingDataError(
            "At least 10 genuine historical exam records are required for an 80:20 evaluation split."
        )

    trained = train(data, features)
    model_version = datetime.now(timezone.utc).strftime("gradiq-%Y%m%dT%H%M%S%fZ")
    os.makedirs(MODEL_DIR, exist_ok=True)
    temp_model_path = MODEL_PATH + ".tmp"
    joblib.dump(trained["model"], temp_model_path)
    os.replace(temp_model_path, MODEL_PATH)

    info = {
        "training_status": "trained",
        "status_message": "Trained using genuine college historical examination data.",
        "model_name": trained["model_name"],
        "model_version": model_version,
        "features": features,
        "target": TARGET,
        "dataset_size": int(len(data)),
        "train_size": trained["train_size"],
        "test_size": trained["test_size"],
        "random_state": 42,
        "dataset_source": dataset_source,
        "feature_selection": {
            "method": (
                "Keep all required college assessment predictors; include previous_semester_marks "
                "only when genuine values are complete and consistently defined."
            ),
            "selected_features": features,
            "target_excluded": TARGET,
        },
        "dataset_note": (
            "Genuine historical records with actual end-semester examination marks. "
            "Evaluation metrics use the held-out test split; the saved model is refitted on all validated records."
        ),
        "duplicate_row_note": (
            f"{quality['duplicate_rows']} exact duplicate row(s) were detected and retained. "
            "Identical marks may belong to different students; repeated imports of the same CSV are blocked."
            if quality["duplicate_rows"] else None
        ),
        "metrics": trained["metrics"],
        "algorithm_comparison": trained["algorithm_comparison"],
        "feature_importance": trained["feature_importance"],
        "data_quality": quality,
    }
    with open(INFO_PATH, "w", encoding="utf-8") as file:
        json.dump(info, file, indent=2, ensure_ascii=False)
    return info


def main():
    parser = argparse.ArgumentParser(description="Train Gradiq from genuine examination records.")
    parser.add_argument("--data", help="CSV file containing historic marks and actual exam results.")
    args = parser.parse_args()
    try:
        if args.data:
            if not os.path.isfile(args.data):
                raise FileNotFoundError(f"Training dataset not found: {args.data}")
            source = pd.read_csv(args.data)
            source_name = os.path.basename(args.data)
        else:
            source = load_database_data()
            source_name = "MySQL imported records and actual examination results"
        if source.empty:
            if not _existing_trained_model():
                _write_untrained_info(
                    "No genuine historical database records with complete actual end-semester marks are available."
                )
            print(UNTRAINED_STATUS)
            return
        info = train_and_save(source, source_name)
        print(json.dumps(info, indent=2, ensure_ascii=False))
    except InsufficientTrainingDataError as error:
        if not _existing_trained_model():
            _write_untrained_info(str(error), dataset_size=len(source))
        print(UNTRAINED_STATUS)
        print(str(error))
    except ValueError as error:
        print(f"Training data rejected: {error}", file=sys.stderr)
        raise SystemExit(2) from error


if __name__ == "__main__":
    main()
