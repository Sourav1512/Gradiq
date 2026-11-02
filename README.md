# Gradiq – Student Performance Prediction System

Gradiq is a React and Flask student performance application with Admin and Student roles. The current assessment structure records actual internal marks out of 40 and predicts end-semester examination marks out of 60.

## Assessment and prediction

| Component | Maximum |
|---|---:|
| Assignment 1 | 5 |
| Assignment 2 | 5 |
| Class Test 1 | 20 |
| Class Test 2 | 20 |
| Combined Class Tests | `(CT1 + CT2) / 2`, maximum 20 |
| Presentation | 10 |
| Internal Total | `A1 + A2 + ((CT1 + CT2) / 2) + Presentation`, maximum 40 |
| End-semester prediction | 60 |
| Estimated overall marks | `Internal Total + Predicted End-Semester Marks`, maximum 100 |

Internal marks are recorded assessment results. End-semester marks are a model estimate and are always bounded to 0–60. Performance categories use the estimated overall score.

## Student codes

Student codes are generated only on the Flask backend in `GRD-YYYY-NNNN` format. A MySQL sequence row is locked within the student-creation transaction, so concurrent registrations receive unique sequential codes. Codes are immutable after creation.

## Technology

- Frontend: React + Vite, React Router, Axios, Recharts
- Backend: Flask, JWT role authorization, MySQL Connector
- ML: scikit-learn regression model, saved under `backend/ml/saved_model`

## Database setup

For a new database, execute `backend/database/database.sql`.

For an existing database:

1. Back up `gradiq_db`.
2. Inspect the migration preflight query for years with more than 9,999 student records. Resolve any such year before continuing.
3. Execute `backend/database/migration.sql` once.
4. Execute `backend/database/migration_ml_training.sql` once to add prediction provenance and the admin-imported genuine training-record table. If the marks migration was already applied, run only this ML migration.
5. Execute `backend/database/migration_rule_based_estimates.sql` once to permit explicitly typed rule-based estimate records.

The migration preserves all students, saves former codes in `students.legacy_student_code`, and retains old prediction values. It deliberately leaves new 40/60 fields empty for historical predictions because legacy 0–100 scores cannot be safely converted into real component marks. The old study-hours column, if present, remains only to preserve legacy data; current APIs do not use it.

## Backend setup

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Configure MySQL connection settings in .env
python ml\train_model.py
python app.py
```

The admin-only **Model Training** page supports CSV upload, validation, EDA, algorithm comparison, and training. Its template is `backend/ml/historical_marks_template.csv`; it contains headers only and no sample students or target values.

Required CSV columns:

`attendance_pct, assignment_1_marks, assignment_2_marks, class_test_1_marks, class_test_2_marks, presentation_marks, actual_semester_marks`

Optional: `previous_semester_marks` (0–100). It is included as a feature only if present and complete for every record. The pipeline derives Combined Class Test and Internal Total from the component marks; it rejects derived marks as extra CSV columns.

Training requires at least 10 valid genuine labeled records. Linear Regression, Decision Tree Regressor, and Random Forest Regressor are evaluated on a reproducible 80:20 split (`random_state=42`) using MAE, MSE, RMSE, and R². The lowest held-out RMSE is selected, and the saved preprocessing/model pipeline is refitted on all eligible records. Required missing or out-of-range values are rejected. Exact duplicate rows are reported but retained because identical marks may belong to different students; re-importing the exact same CSV file is blocked.

The eight required college assessment predictors are always retained. Previous-semester marks are considered only when the data is genuine, consistently defined on the same 0–100 scale, and complete for every training record. No rule-based fallback exists in the current workflow; without a trained model, prediction is explicitly pending rather than presented as an ML result.

No public dataset is used as a substitute for college assessment records. For example, the public [UCI Student Performance dataset](https://archive.ics.uci.edu/dataset/320/student+performance) uses G1/G2/G3 grades and lacks Gradiq's exact assignment, two class-test, presentation, attendance-percentage, and 60-mark exam schema, so it is incompatible. The project and connected database currently contain no labeled records suitable for honest model evaluation.

For command-line training from a genuine CSV, the backend script also accepts:

```powershell
python ml\train_model.py --data path\to\historical_results.csv
```

Uploaded records are stored in `ml_training_records`; actual examination results recorded in prediction history are also eligible when all required component marks exist. EDA visualizations, feature relationships, and correlations use only these genuine labeled records. Until enough records are supplied, status remains “Model Not Trained – Genuine Historical Examination Data Required.”

## Frontend setup

```powershell
cd frontend
npm install
npm run dev
```

The Vite development server proxies API requests to Flask on port 5000.

## Roles and API

- Admin: student management, input/update of assessment marks, actual result recording, predictions, history and analytics.
- Student: view only their own profile, internal marks, predicted examination marks and prediction history.
- Flask enforces roles on API endpoints; Student endpoints use the authenticated account email and cannot select another student.

Key endpoints include `/api/students/`, `/api/predict`, `/api/predictions`, `/api/analytics`, `/api/model-info`, admin-only `/api/model-training/*`, and `/api/student/*`.

## Tests and build

```powershell
cd backend
python test_backend_integrity.py
cd ..\frontend
npm run lint
npm run build
```
