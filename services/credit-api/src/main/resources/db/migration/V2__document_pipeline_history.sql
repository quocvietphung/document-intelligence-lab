-- Preserve existing dossiers and files. Historical stages are deliberately not invented.
ALTER TABLE lab_jobs ADD COLUMN IF NOT EXISTS next_attempt_at timestamp;
ALTER TABLE lab_jobs ADD COLUMN IF NOT EXISTS finished_at timestamp;
ALTER TABLE lab_jobs ADD COLUMN IF NOT EXISTS retry_of varchar(80);
ALTER TABLE lab_jobs ADD COLUMN IF NOT EXISTS last_actor varchar(160);
DROP INDEX IF EXISTS lab_jobs_unique_active;
CREATE UNIQUE INDEX lab_jobs_unique_active ON lab_jobs(tenant,case_id,sha256)
 WHERE status NOT IN ('FAILED','EXPIRED','CANCELLED');
CREATE TABLE IF NOT EXISTS lab_job_events (
 id bigserial PRIMARY KEY, job_id varchar(80) NOT NULL, tenant varchar(120) NOT NULL,
 case_id varchar(80) NOT NULL, stage varchar(80) NOT NULL, status varchar(32) NOT NULL,
 attempt integer NOT NULL, error_code varchar(120), actor varchar(160) NOT NULL, occurred_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS lab_job_events_scope ON lab_job_events(tenant,case_id,job_id,id);
CREATE OR REPLACE FUNCTION record_lab_job_event() RETURNS trigger AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO lab_job_events(job_id,tenant,case_id,stage,status,attempt,error_code,actor)
  VALUES(NEW.id,NEW.tenant,NEW.case_id,NEW.stage,NEW.status,NEW.attempt,NEW.error_code,COALESCE(NEW.last_actor,NEW.actor));
 ELSIF ROW(OLD.stage,OLD.status,OLD.attempt,OLD.error_code) IS DISTINCT FROM ROW(NEW.stage,NEW.status,NEW.attempt,NEW.error_code) THEN
  INSERT INTO lab_job_events(job_id,tenant,case_id,stage,status,attempt,error_code,actor)
  VALUES(NEW.id,NEW.tenant,NEW.case_id,NEW.stage,NEW.status,NEW.attempt,NEW.error_code,COALESCE(NEW.last_actor,NEW.actor));
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER lab_jobs_record_event AFTER INSERT OR UPDATE ON lab_jobs
 FOR EACH ROW EXECUTE FUNCTION record_lab_job_event();
