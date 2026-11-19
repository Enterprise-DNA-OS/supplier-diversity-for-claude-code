CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE suppliers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(length(trim(source))>0), external_id text NOT NULL CHECK(length(trim(external_id))>0),
 name text NOT NULL CHECK(length(trim(name))>0), owner text NOT NULL CHECK(length(trim(owner))>0),
 review_due date NOT NULL, retention_review_due date NOT NULL, source_ref text NOT NULL CHECK(length(trim(source_ref))>0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id)
);
CREATE TABLE programmes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, external_id text NOT NULL,
 name text NOT NULL CHECK(length(trim(name))>0), owner text NOT NULL, currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 scheme text NOT NULL CHECK(length(trim(scheme))>0), goal_bps integer NOT NULL CHECK(goal_bps BETWEEN 0 AND 10000),
 start_date date NOT NULL, end_date date NOT NULL, report_due date NOT NULL, source_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id), CHECK(end_date>=start_date)
);
CREATE TABLE certificates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, external_id text NOT NULL,
 supplier_id uuid NOT NULL REFERENCES suppliers(id), scheme text NOT NULL, issuer text NOT NULL,
 valid_from date NOT NULL, valid_to date NOT NULL, reviewed_by text NOT NULL, evidence_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id), CHECK(valid_to>=valid_from)
);
CREATE TABLE commitments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, external_id text NOT NULL,
 programme_id uuid NOT NULL REFERENCES programmes(id), supplier_id uuid NOT NULL REFERENCES suppliers(id),
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000000), source_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id)
);
CREATE TABLE spend (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, external_id text NOT NULL,
 programme_id uuid NOT NULL REFERENCES programmes(id), supplier_id uuid NOT NULL REFERENCES suppliers(id),
 paid_date date NOT NULL, amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 1000000000000), evidence_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source,external_id)
);
CREATE TABLE actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), programme_id uuid NOT NULL REFERENCES programmes(id), title text NOT NULL,
 owner text NOT NULL, due date NOT NULL, state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
 closure_evidence text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((state='open' AND closure_evidence IS NULL) OR (state='closed' AND length(trim(closure_evidence))>0))
);
CREATE TABLE notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), programme_id uuid NOT NULL REFERENCES programmes(id), actor text NOT NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL, fingerprint text NOT NULL UNIQUE,
 source_ref text NOT NULL, actor text NOT NULL, row_count integer NOT NULL, added integer NOT NULL, skipped integer NOT NULL,
 scope jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor text NOT NULL, verb text NOT NULL, detail jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION protect_evidence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Evidence is append-only. Use a reviewed correction or retention migration.'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['suppliers','programmes','certificates','commitments','spend','actions','notes','import_batches','activity'] LOOP
  EXECUTE format('CREATE TRIGGER touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',t);
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['programmes','certificates','commitments','spend','notes','import_batches','activity'] LOOP
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION protect_evidence()',t);
 END LOOP;
END $$;
CREATE INDEX cert_lookup ON certificates(supplier_id,scheme,valid_from,valid_to);
CREATE INDEX spend_lookup ON spend(programme_id,supplier_id,paid_date);
CREATE VIEW spend_evidence AS
 SELECT s.*,p.name programme,p.currency,p.scheme,sp.name supplier,
 s.paid_date BETWEEN p.start_date AND p.end_date AS in_period,
 EXISTS(SELECT 1 FROM certificates c WHERE c.supplier_id=s.supplier_id AND c.scheme=p.scheme
  AND s.paid_date BETWEEN c.valid_from AND c.valid_to) AS has_dated_evidence
 FROM spend s JOIN programmes p ON p.id=s.programme_id JOIN suppliers sp ON sp.id=s.supplier_id;
CREATE VIEW participation_review AS
 SELECT p.id programme_id,p.name programme,p.currency,p.scheme,p.goal_bps,
 coalesce(x.total,0)::bigint total_paid_cents,coalesce(x.covered,0)::bigint evidence_covered_cents,
 CASE WHEN x.total>0 THEN round(100.0*x.covered/x.total,2) END evidence_share_pct,
 coalesce(c.total,0)::bigint committed_cents,p.report_due
 FROM programmes p
 LEFT JOIN LATERAL(SELECT sum(amount_cents) total,sum(CASE WHEN has_dated_evidence THEN amount_cents ELSE 0 END) covered
  FROM spend_evidence WHERE programme_id=p.id AND in_period) x ON true
 LEFT JOIN LATERAL(SELECT sum(amount_cents) total FROM commitments WHERE programme_id=p.id)c ON true;
CREATE VIEW compliance_findings AS
 SELECT 'ACCURACY'::text rule,s.name record,'Supplier accuracy review due'::text finding FROM suppliers s WHERE review_due<CURRENT_DATE
 UNION ALL SELECT 'RETENTION',name,'Supplier retention review due' FROM suppliers WHERE retention_review_due<CURRENT_DATE
 UNION ALL SELECT 'EVIDENCE',supplier,'Paid record has no matching dated certificate: '||external_id FROM spend_evidence WHERE NOT has_dated_evidence
 UNION ALL SELECT 'PERIOD',programme,'Paid record outside reporting period: '||external_id FROM spend_evidence WHERE NOT in_period;
CREATE VIEW attention_review AS
 SELECT 'action'::text kind,p.name programme,a.title detail,a.owner,a.due FROM actions a JOIN programmes p ON p.id=a.programme_id WHERE state='open' AND due<CURRENT_DATE
 UNION ALL SELECT 'report',name,'Programme report due',owner,report_due FROM programmes WHERE report_due<CURRENT_DATE
 UNION ALL SELECT 'certificate',s.name,c.scheme||' evidence expires',s.owner,c.valid_to FROM certificates c JOIN suppliers s ON s.id=c.supplier_id WHERE c.valid_to<=CURRENT_DATE+30
 UNION ALL SELECT 'supplier',name,'Accuracy review due',owner,review_due FROM suppliers WHERE review_due<CURRENT_DATE;
REVOKE ALL ON spend_evidence,participation_review,compliance_findings,attention_review FROM PUBLIC;
