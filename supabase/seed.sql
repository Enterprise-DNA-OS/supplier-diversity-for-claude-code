DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM suppliers WHERE source='fictional-demo') THEN RETURN; END IF;
 INSERT INTO suppliers(id,source,external_id,name,owner,review_due,retention_review_due,source_ref) VALUES
 ('10000000-0000-0000-0000-000000000001','fictional-demo','S1','Fictional Harbour Supplies','Alex',CURRENT_DATE-8,CURRENT_DATE+90,'Fictional supplier register'),
 ('10000000-0000-0000-0000-000000000002','fictional-demo','S2','Fictional Harbour Services','Casey',CURRENT_DATE+30,CURRENT_DATE-2,'Fictional supplier register'),
 ('10000000-0000-0000-0000-000000000003','fictional-demo','S3','Fictional Ridge Equipment','Alex',CURRENT_DATE+30,CURRENT_DATE+90,'Fictional supplier register');
 INSERT INTO programmes(id,source,external_id,name,owner,currency,scheme,goal_bps,start_date,end_date,report_due,source_ref) VALUES
 ('20000000-0000-0000-0000-000000000001','fictional-demo','P1','Fictional Local Purchasing','Casey','NZD','Demo local supplier',4000,CURRENT_DATE-90,CURRENT_DATE+30,CURRENT_DATE-3,'Voluntary fictional programme'),
 ('20000000-0000-0000-0000-000000000002','fictional-demo','P2','Fictional Regional Purchasing','Alex','AUD','Demo local supplier',3000,CURRENT_DATE-90,CURRENT_DATE+30,CURRENT_DATE+14,'Voluntary fictional programme');
 INSERT INTO certificates(source,external_id,supplier_id,scheme,issuer,valid_from,valid_to,reviewed_by,evidence_ref) VALUES
 ('fictional-demo','C1','10000000-0000-0000-0000-000000000001','Demo local supplier','Fictional programme office',CURRENT_DATE-100,CURRENT_DATE+15,'Alex','Fictional certificate A'),
 ('fictional-demo','C2','10000000-0000-0000-0000-000000000001','Demo local supplier','Fictional programme office',CURRENT_DATE-50,CURRENT_DATE+20,'Alex','Fictional overlapping certificate'),
 ('fictional-demo','C3','10000000-0000-0000-0000-000000000002','Demo local supplier','Fictional programme office',CURRENT_DATE-100,CURRENT_DATE-40,'Casey','Fictional expired certificate');
 INSERT INTO commitments(source,external_id,programme_id,supplier_id,amount_cents,source_ref) VALUES
 ('fictional-demo','K1','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',800000,'Fictional purchase commitment');
 INSERT INTO spend(source,external_id,programme_id,supplier_id,paid_date,amount_cents,evidence_ref) VALUES
 ('fictional-demo','E1','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',CURRENT_DATE-10,300000,'Fictional paid invoice 1'),
 ('fictional-demo','E2','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',CURRENT_DATE-5,200000,'Fictional paid invoice 2'),
 ('fictional-demo','E3','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003',CURRENT_DATE-4,500000,'Fictional paid invoice 3'),
 ('fictional-demo','E4','20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',CURRENT_DATE-4,100000,'Fictional AUD invoice'),
 ('fictional-demo','E5','20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',CURRENT_DATE-120,900000,'Fictional prior period invoice');
 INSERT INTO actions(id,programme_id,title,owner,due) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Request current certificate evidence','Casey',CURRENT_DATE-4),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Reconcile missing supplier evidence','Alex',CURRENT_DATE+7);
 INSERT INTO notes(programme_id,actor,body) VALUES('20000000-0000-0000-0000-000000000001','Alex','Demo amounts and certificates are fictional. The evidence share is not statutory participation credit.');
END $$;
