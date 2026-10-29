-- Derived, source-versioned projections. Existing dossiers and review decisions stay intact.
CREATE TABLE document_analytics_runs (
 tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, id varchar(80) NOT NULL,
 case_version bigint NOT NULL, source_hash varchar(64) NOT NULL, method varchar(100) NOT NULL,
 created_at timestamp NOT NULL, payload text NOT NULL, PRIMARY KEY(tenant,case_id,id)
);
CREATE INDEX document_analytics_runs_scope ON document_analytics_runs(tenant,case_id,created_at);
CREATE TABLE document_analytics_findings (
 tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, run_id varchar(80) NOT NULL,
 id varchar(80) NOT NULL, document_id varchar(80) NOT NULL, page integer NOT NULL,
 field_key varchar(120) NOT NULL, code varchar(100) NOT NULL, category varchar(32) NOT NULL,
 source_ids text NOT NULL, PRIMARY KEY(tenant,case_id,run_id,id),
 FOREIGN KEY(tenant,case_id,run_id) REFERENCES document_analytics_runs(tenant,case_id,id)
);
CREATE TABLE document_analytics_reviews (
 tenant varchar(120) NOT NULL, case_id varchar(80) NOT NULL, request_id varchar(80) NOT NULL,
 run_id varchar(80) NOT NULL, finding_id varchar(80) NOT NULL, state varchar(32) NOT NULL,
 note varchar(1000) NOT NULL, actor varchar(160) NOT NULL, created_at timestamp NOT NULL,
 PRIMARY KEY(tenant,case_id,request_id),
 FOREIGN KEY(tenant,case_id,run_id,finding_id) REFERENCES document_analytics_findings(tenant,case_id,run_id,id)
);
