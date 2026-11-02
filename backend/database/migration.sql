-- Gradiq marks and student-code migration for an existing MySQL 8 database.
-- Back up the database first and run this script once. It preserves rows and
-- old student codes; legacy prediction fields remain untouched for history.
USE gradiq_db;

-- Check this result first. Stop and resolve any year with more than 9,999
-- students before continuing, since the required code format has four digits.
SELECT YEAR(created_at) AS admission_year, COUNT(*) AS student_count
FROM students
GROUP BY YEAR(created_at)
HAVING COUNT(*) > 9999;

CREATE TEMPORARY TABLE student_code_capacity_guard (
    admission_year SMALLINT NOT NULL PRIMARY KEY,
    student_count INT NOT NULL,
    CONSTRAINT chk_student_code_capacity CHECK (student_count <= 9999)
);
INSERT INTO student_code_capacity_guard
SELECT YEAR(created_at), COUNT(*) FROM students GROUP BY YEAR(created_at);
DROP TEMPORARY TABLE student_code_capacity_guard;

ALTER TABLE students
    ADD COLUMN legacy_student_code VARCHAR(20) NULL AFTER student_id,
    MODIFY COLUMN student_id VARCHAR(64) NOT NULL,
    MODIFY COLUMN attendance DECIMAL(5,2) NULL DEFAULT NULL,
    MODIFY COLUMN previous_marks DECIMAL(5,2) NULL DEFAULT NULL;

CREATE TABLE student_code_sequences (
    admission_year SMALLINT NOT NULL PRIMARY KEY,
    last_number SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_student_sequence CHECK (last_number BETWEEN 0 AND 9999)
);

CREATE TEMPORARY TABLE student_code_migration AS
SELECT
    id,
    student_id AS old_code,
    YEAR(created_at) AS admission_year,
    CONCAT(
        'GRD-', YEAR(created_at), '-',
        LPAD(ROW_NUMBER() OVER (PARTITION BY YEAR(created_at) ORDER BY id), 4, '0')
    ) AS new_code
FROM students;

START TRANSACTION;
UPDATE students AS s
JOIN student_code_migration AS m ON m.id = s.id
SET s.legacy_student_code = m.old_code,
    s.student_id = CONCAT('TMP-', UUID());

UPDATE students AS s
JOIN student_code_migration AS m ON m.id = s.id
SET s.student_id = m.new_code;
COMMIT;

DROP TEMPORARY TABLE student_code_migration;
ALTER TABLE students
    MODIFY COLUMN student_id VARCHAR(20) NOT NULL,
    ADD CONSTRAINT chk_student_code
        CHECK (student_id REGEXP '^GRD-[0-9]{4}-[0-9]{4}$'),
    ADD CONSTRAINT chk_student_attendance
        CHECK (attendance IS NULL OR attendance BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_student_previous_marks
        CHECK (previous_marks IS NULL OR previous_marks BETWEEN 0 AND 100);

INSERT INTO student_code_sequences (admission_year, last_number)
SELECT YEAR(created_at), MAX(CAST(SUBSTRING_INDEX(student_id, '-', -1) AS UNSIGNED))
FROM students
GROUP BY YEAR(created_at);

ALTER TABLE predictions
    ADD COLUMN assignment_1_marks DECIMAL(5,2) NULL,
    ADD COLUMN assignment_2_marks DECIMAL(5,2) NULL,
    ADD COLUMN class_test_1_marks DECIMAL(5,2) NULL,
    ADD COLUMN class_test_2_marks DECIMAL(5,2) NULL,
    ADD COLUMN combined_class_test_marks DECIMAL(5,2) NULL,
    ADD COLUMN presentation_marks DECIMAL(5,2) NULL,
    ADD COLUMN internal_total DECIMAL(5,2) NULL,
    ADD COLUMN previous_semester_marks DECIMAL(5,2) NULL,
    ADD COLUMN predicted_semester_marks DECIMAL(5,2) NULL,
    ADD COLUMN estimated_overall_marks DECIMAL(5,2) NULL,
    ADD COLUMN actual_semester_marks DECIMAL(5,2) NULL;

-- Keep old prediction values for reference while allowing new 40/60 rows to
-- omit obsolete fields that are no longer part of the prediction contract.
ALTER TABLE predictions
    MODIFY COLUMN previous_marks DECIMAL(5,2) NULL DEFAULT NULL,
    MODIFY COLUMN assignment_marks DECIMAL(5,2) NULL DEFAULT NULL,
    MODIFY COLUMN daily_study_hours DECIMAL(4,2) NULL DEFAULT NULL,
    MODIFY COLUMN class_participation DECIMAL(4,2) NULL DEFAULT NULL,
    MODIFY COLUMN internal_assessment DECIMAL(5,2) NULL DEFAULT NULL,
    MODIFY COLUMN completed_assignments INT NULL DEFAULT NULL,
    MODIFY COLUMN predicted_marks DECIMAL(5,2) NULL DEFAULT NULL,
    MODIFY COLUMN performance_category VARCHAR(30) NULL DEFAULT NULL;

ALTER TABLE predictions
    ADD CONSTRAINT chk_prediction_attendance CHECK (
        attendance_pct BETWEEN 0 AND 100
    ),
    ADD CONSTRAINT chk_prediction_assignment_1 CHECK (
        assignment_1_marks IS NULL OR assignment_1_marks BETWEEN 0 AND 5
    ),
    ADD CONSTRAINT chk_prediction_assignment_2 CHECK (
        assignment_2_marks IS NULL OR assignment_2_marks BETWEEN 0 AND 5
    ),
    ADD CONSTRAINT chk_prediction_ct1 CHECK (
        class_test_1_marks IS NULL OR class_test_1_marks BETWEEN 0 AND 20
    ),
    ADD CONSTRAINT chk_prediction_ct2 CHECK (
        class_test_2_marks IS NULL OR class_test_2_marks BETWEEN 0 AND 20
    ),
    ADD CONSTRAINT chk_prediction_combined_ct CHECK (
        combined_class_test_marks IS NULL OR combined_class_test_marks BETWEEN 0 AND 20
    ),
    ADD CONSTRAINT chk_prediction_combined_formula CHECK (
        class_test_1_marks IS NULL OR class_test_2_marks IS NULL
        OR combined_class_test_marks IS NULL
        OR combined_class_test_marks = ROUND((class_test_1_marks + class_test_2_marks) / 2, 2)
    ),
    ADD CONSTRAINT chk_prediction_presentation CHECK (
        presentation_marks IS NULL OR presentation_marks BETWEEN 0 AND 10
    ),
    ADD CONSTRAINT chk_prediction_internal CHECK (
        internal_total IS NULL OR internal_total BETWEEN 0 AND 40
    ),
    ADD CONSTRAINT chk_prediction_internal_formula CHECK (
        assignment_1_marks IS NULL OR assignment_2_marks IS NULL
        OR combined_class_test_marks IS NULL OR presentation_marks IS NULL
        OR internal_total IS NULL
        OR internal_total = assignment_1_marks + assignment_2_marks
            + combined_class_test_marks + presentation_marks
    ),
    ADD CONSTRAINT chk_prediction_previous CHECK (
        previous_semester_marks IS NULL OR previous_semester_marks BETWEEN 0 AND 100
    ),
    ADD CONSTRAINT chk_prediction_semester CHECK (
        predicted_semester_marks IS NULL OR predicted_semester_marks BETWEEN 0 AND 60
    ),
    ADD CONSTRAINT chk_prediction_overall CHECK (
        estimated_overall_marks IS NULL OR estimated_overall_marks BETWEEN 0 AND 100
    ),
    ADD CONSTRAINT chk_prediction_overall_formula CHECK (
        internal_total IS NULL OR predicted_semester_marks IS NULL
        OR estimated_overall_marks IS NULL
        OR estimated_overall_marks = internal_total + predicted_semester_marks
    ),
    ADD CONSTRAINT chk_prediction_actual CHECK (
        actual_semester_marks IS NULL OR actual_semester_marks BETWEEN 0 AND 60
    );

-- Historical rows are deliberately left NULL for new marks. Old 0–100
-- predictions and behavioural inputs cannot be converted into actual 40/60
-- component marks or actual examination labels without inventing data.
-- The old daily_study_hours column remains only as archived legacy history;
-- the updated application never reads from or writes to it.
