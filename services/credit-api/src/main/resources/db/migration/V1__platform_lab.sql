CREATE TABLE IF NOT EXISTS lab_jobs (
 id varchar(80) PRIMARY KEY, tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL,
 actor varchar(160) NOT NULL, name varchar(120) NOT NULL, content_type varchar(100) NOT NULL,
 object_key varchar(300) NOT NULL, sha256 varchar(64) NOT NULL, status varchar(32) NOT NULL,
 stage varchar(80) NOT NULL, created_at timestamp NOT NULL, updated_at timestamp NOT NULL,
 expires_at timestamp NOT NULL, attempt integer NOT NULL DEFAULT 0,
 document_id varchar(80), scan_result varchar(120), error_code varchar(120)
);
CREATE INDEX IF NOT EXISTS lab_jobs_scope ON lab_jobs(tenant,case_id,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS lab_jobs_unique_active ON lab_jobs(tenant,case_id,sha256) WHERE status NOT IN ('FAILED','EXPIRED');
CREATE TABLE IF NOT EXISTS lab_records (
 tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, kind varchar(50) NOT NULL,
 id varchar(80) NOT NULL, created_at timestamp NOT NULL, payload text NOT NULL,
 PRIMARY KEY(tenant,case_id,kind,id)
);
CREATE INDEX IF NOT EXISTS lab_records_scope ON lab_records(tenant,case_id,kind,created_at);
