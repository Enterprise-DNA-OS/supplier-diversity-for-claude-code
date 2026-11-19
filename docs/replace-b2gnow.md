# Replace the supplier programme reporting desk around B2Gnow

B2Gnow's [vendor management page](https://b2gnow.com/solutions/vendor-management-software/) describes report exports. Its hosted [NYS outreach manual](https://ny.newnycontracts.com/upload/customer/ny/documents/NYS-Outreach.pdf) documents selection of fields and CSV export; access to that manual can be restricted. The [Columbus system overview](https://www.columbus.gov/files/content/city/v/11/government/mayors-office/office-of-diversity-and-inclusion/supplier-development/b2gnowstaffusermanual-chapter1-systemoverview.pdf) documents Excel report output. Actual permissions, report types and columns depend on your account. This importer never assumes a universal set of B2Gnow column names.

## Prepare the exported records

1. Sign in to your own B2Gnow account with permission to export the selected reports. Record the source instance, report names, filters, date periods and independently checked row counts. Use Reporting and the output/export option available to that report. Export CSV when offered, or save an authorised Excel report as UTF-8 CSV.
2. Export the supplier directory and the programme, certificate, commitment and paid-spend reports you need. Keep the original files private. A report containing names alone is insufficient to recover relationships: retain stable vendor and programme IDs.
3. Map each actual exported column explicitly in a manifest. Report names, exported column names and currency conventions vary. Do not silently substitute defaults. If the report lacks an owner, review date, issuer evidence or source reference, enrich a private staging copy with values agreed and recorded by the operator. Describe the transformations in source_ref.
4. Convert money to integer minor units only after confirming currency and decimal conventions. This implementation accepts positive cents, no negative credits, netting or currency conversion. Preserve one reference per paid line. Multiple lines of an invoice need distinct stable line IDs. Dates must be YYYY-MM-DD.
5. Run the command below first with --dry-run. Reconcile counts and totals by currency with the exports. Then run the same command without that switch. This is one command for the prepared bundle; export permissions, mapping and reconciliation determine whether the switch fits one day.

```bash
npm run diversity -- import b2gnow --manifest=imports/manifest.json --actor="Actual operator" --dry-run
```

## Manifest contract

See examples/import-manifest.json for a runnable fictional supplier-only example. Its illustrative headers are ours, not claimed B2Gnow defaults. After mapping, one manifest can list the five record types in this order:

| Kind | Required mapping keys |
|---|---|
| suppliers | external_id, name, owner, review_due, retention_review_due, source_ref |
| programmes | external_id, name, owner, currency, scheme, goal_bps, start_date, end_date, report_due, source_ref |
| certificates | external_id, supplier_external_id, scheme, issuer, valid_from, valid_to, reviewed_by, evidence_ref |
| commitments | external_id, programme_external_id, supplier_external_id, amount_cents, currency, source_ref |
| spend | external_id, programme_external_id, supplier_external_id, paid_date, amount_cents, currency, evidence_ref |

Each file entry requires kind, path, expected_count and columns. columns maps every key above to one actual CSV header. Paths resolve relative to the manifest. source identifies one B2Gnow instance and source_ref records report provenance. References resolve by external ID within that source only. Blank required cells, missing headers, malformed dates, duplicate IDs, currency mismatch and unresolved references fail the entire bundle. Unknown mapping keys fail. Unmapped exported columns are ignored and not stored.

Exact replay is skipped. Changed evidence under an existing source and external ID is refused; no silent overwrite. All files run in one transaction. A failed import adds no records. Import history stores file fingerprints, declared counts, added/skipped counts, actor and source. A fingerprint is provenance, not proof that the export is complete or accurate.

## What does not carry over automatically

Certificate scans, vendor portal logins, application decisions, statutory credit determinations, external directories, personal demographic attributes, payroll, grants, message history and existing platform workflows are not imported. Certificate evidence references point to controlled external storage; the base does not copy attachments. Notes and review actions can be added locally. Keep original exports and documents according to your retention policy.

Do not cancel the platform on the strength of an import. Agree which functions are being replaced, reconcile the records, validate the resulting reports and retain the authorised systems for certification decisions and government submissions. Enterprise DNA scopes further mapping, access controls, connections and screens as part of your version.

Built and optionally operated through Omni by Enterprise DNA.
