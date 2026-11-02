-- =============================================================
-- Gradiq – Student Performance Prediction System
-- Database: gradiq_db
-- Description: Complete schema for all application tables
-- =============================================================

CREATE DATABASE IF NOT EXISTS gradiq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gradiq_db;

-- -----------------------------------------------------------
-- Table: users
-- Stores login credentials for students and administrators
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    full_name   VARCHAR(150)  NOT NULL,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,          -- bcrypt hashed password
    role        ENUM('admin','student') NOT NULL DEFAULT 'student',
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------
-- Table: students
-- Academic profile and records of students
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_id      VARCHAR(20)   NOT NULL UNIQUE,
    full_name       VARCHAR(150)  NOT NULL,
    email           VARCHAR(255)  NOT NULL UNIQUE,
    course          VARCHAR(100)  NOT NULL,
    semester        INT           NOT NULL DEFAULT 1,
    attendance      DECIMAL(5,2)  NULL DEFAULT NULL,
    previous_marks  DECIMAL(5,2)  NULL DEFAULT NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_student_code CHECK (student_id REGEXP '^GRD-[0-9]{4}-[0-9]{4}$'),
    CONSTRAINT chk_student_attendance CHECK (attendance IS NULL OR attendance BETWEEN 0 AND 100),
    CONSTRAINT chk_student_previous_marks CHECK (previous_marks IS NULL OR previous_marks BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS student_code_sequences (
    admission_year  SMALLINT NOT NULL PRIMARY KEY,
    last_number     SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_student_sequence CHECK (last_number BETWEEN 0 AND 9999)
);

-- -----------------------------------------------------------
-- Table: predictions
-- Stores feature inputs and ML model prediction results
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS predictions (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    student_id              INT           NOT NULL,
    attendance_pct          DECIMAL(5,2)  NOT NULL,
    assignment_1_marks      DECIMAL(5,2)  NOT NULL,
    assignment_2_marks      DECIMAL(5,2)  NOT NULL,
    class_test_1_marks      DECIMAL(5,2)  NOT NULL,
    class_test_2_marks      DECIMAL(5,2)  NOT NULL,
    combined_class_test_marks DECIMAL(5,2) NOT NULL,
    presentation_marks      DECIMAL(5,2)  NOT NULL,
    internal_total          DECIMAL(5,2)  NOT NULL,
    previous_semester_marks DECIMAL(5,2)  NULL,
    predicted_semester_marks DECIMAL(5,2) NULL,
    estimated_overall_marks DECIMAL(5,2)  NULL,
    actual_semester_marks   DECIMAL(5,2)  NULL,
    performance_category    VARCHAR(30)   NULL,
    prediction_type         VARCHAR(24)   NOT NULL DEFAULT 'pending',
    model_version           VARCHAR(64)   NULL,
    created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pred_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT chk_attendance_pct CHECK (attendance_pct BETWEEN 0 AND 100),
    CONSTRAINT chk_assignment_1 CHECK (assignment_1_marks BETWEEN 0 AND 5),
    CONSTRAINT chk_assignment_2 CHECK (assignment_2_marks BETWEEN 0 AND 5),
    CONSTRAINT chk_class_test_1 CHECK (class_test_1_marks BETWEEN 0 AND 20),
    CONSTRAINT chk_class_test_2 CHECK (class_test_2_marks BETWEEN 0 AND 20),
    CONSTRAINT chk_combined_test CHECK (
        combined_class_test_marks BETWEEN 0 AND 20
        AND combined_class_test_marks = ROUND((class_test_1_marks + class_test_2_marks) / 2, 2)
    ),
    CONSTRAINT chk_presentation CHECK (presentation_marks BETWEEN 0 AND 10),
    CONSTRAINT chk_internal_total CHECK (
        internal_total BETWEEN 0 AND 40
        AND internal_total = assignment_1_marks + assignment_2_marks
            + combined_class_test_marks + presentation_marks
    ),
    CONSTRAINT chk_previous_semester CHECK (
        previous_semester_marks IS NULL OR previous_semester_marks BETWEEN 0 AND 100
    ),
    CONSTRAINT chk_predicted_semester CHECK (predicted_semester_marks BETWEEN 0 AND 60),
    CONSTRAINT chk_estimated_overall CHECK (
        estimated_overall_marks BETWEEN 0 AND 100
        AND estimated_overall_marks = internal_total + predicted_semester_marks
    ),
    CONSTRAINT chk_actual_semester CHECK (
        actual_semester_marks IS NULL OR actual_semester_marks BETWEEN 0 AND 60
    ),
    CONSTRAINT chk_prediction_type CHECK (
        prediction_type IN ('ml_prediction', 'rule_based_estimate', 'estimate', 'pending', 'legacy')
    )
);

CREATE TABLE IF NOT EXISTS ml_training_records (
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

-- -----------------------------------------------------------
-- Default admin user (password: Admin@123)
-- Seeded with a verified bcrypt hash (tested with bcrypt.checkpw)
-- -----------------------------------------------------------
INSERT IGNORE INTO users (full_name, email, password, role)
VALUES (
    'Admin',
    'admin@gradiq.com',
    '$2b$12$0lmJ1JsrLNGmwlL8pWcDUeUbj9MuLPB.emsaa/hdvxKdd5C69jByS',
    'admin'
);

INSERT IGNORE INTO users (full_name, email, password, role)
VALUES (
    'Admin',
    'admin@gradivo.com',
    '$2b$12$0lmJ1JsrLNGmwlL8pWcDUeUbj9MuLPB.emsaa/hdvxKdd5C69jByS',
    'admin'
);
