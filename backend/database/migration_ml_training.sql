-- Add admin CSV-import training storage and prediction provenance.
-- Back up the database first. Run this migration once after migration.sql.
USE gradiq_db;

ALTER TABLE predictions
    ADD COLUMN prediction_type VARCHAR(24) NOT NULL DEFAULT 'legacy',
    ADD COLUMN model_version VARCHAR(64) NULL,
    ADD CONSTRAINT chk_prediction_type CHECK (
        prediction_type IN ('ml_prediction', 'rule_based_estimate', 'estimate', 'pending', 'legacy')
    );

CREATE TABLE ml_training_records (
    id                       BIGINT AUTO_INCREMENT PRIMARY KEY,
    import_sha256            CHAR(64)      NOT NULL,
    source_row_number        INT UNSIGNED  NOT NULL,
    source_filename          VARCHAR(255)  NOT NULL,
    attendance_pct           DECIMAL(5,2)  NOT NULL,
    assignment_1_marks       DECIMAL(5,2)  NOT NULL,
    assignment_2_marks       DECIMAL(5,2)  NOT NULL,
    class_test_1_marks       DECIMAL(5,2)  NOT NULL,
    class_test_2_marks       DECIMAL(5,2)  NOT NULL,
    presentation_marks       DECIMAL(5,2)  NOT NULL,
    previous_semester_marks  DECIMAL(5,2)  NULL,
    actual_semester_marks    DECIMAL(5,2)  NOT NULL,
    imported_by              INT           NOT NULL,
    imported_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_training_import_row (import_sha256, source_row_number),
    CONSTRAINT fk_training_imported_by FOREIGN KEY (imported_by) REFERENCES users(id),
    CONSTRAINT chk_training_attendance CHECK (attendance_pct BETWEEN 0 AND 100),
    CONSTRAINT chk_training_assignment_1 CHECK (assignment_1_marks BETWEEN 0 AND 5),
    CONSTRAINT chk_training_assignment_2 CHECK (assignment_2_marks BETWEEN 0 AND 5),
    CONSTRAINT chk_training_ct1 CHECK (class_test_1_marks BETWEEN 0 AND 20),
    CONSTRAINT chk_training_ct2 CHECK (class_test_2_marks BETWEEN 0 AND 20),
    CONSTRAINT chk_training_presentation CHECK (presentation_marks BETWEEN 0 AND 10),
    CONSTRAINT chk_training_previous CHECK (
        previous_semester_marks IS NULL OR previous_semester_marks BETWEEN 0 AND 100
    ),
    CONSTRAINT chk_training_actual CHECK (actual_semester_marks BETWEEN 0 AND 60)
);
