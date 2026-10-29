CREATE TABLE lab_assistant_runs (
 tenant varchar(120) NOT NULL, actor varchar(160) NOT NULL, request_id varchar(36) NOT NULL,
 case_id varchar(80) NOT NULL, owner_id varchar(36) NOT NULL,
 status varchar(32) NOT NULL, phase varchar(24) NOT NULL, cancelled boolean NOT NULL,
 started_at timestamp NOT NULL, updated_at timestamp NOT NULL, lease_until timestamp NOT NULL,
 PRIMARY KEY(tenant, actor, request_id)
);
CREATE INDEX lab_assistant_runs_lease ON lab_assistant_runs(status, lease_until);
