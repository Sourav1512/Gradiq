-- Permit the explicitly labeled provisional rule-based estimate type.
-- Back up the database first. Run this once after migration_ml_training.sql.
USE gradiq_db;

ALTER TABLE predictions
    DROP CHECK chk_prediction_type,
    ADD CONSTRAINT chk_prediction_type CHECK (
        prediction_type IN ('ml_prediction', 'rule_based_estimate', 'estimate', 'pending', 'legacy')
    );
