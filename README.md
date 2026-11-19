# Supplier Diversity for Claude Code

Own the supplier records, certificate evidence and participation reviews behind your purchasing programme. This is a focused alternative to the reporting workflows around B2Gnow, built by Enterprise DNA. MIT licence. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free. Install the database and commands below. | Your fields, reporting rules, data mapping and screens. | Installed and operated through Omni by Enterprise DNA. Setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=b2gnow) | [Book a call](https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=github&utm_campaign=b2gnow) |

A [November 2025 City of Savannah procurement record](https://agenda.savannahga.gov/agendaitem/previewagendaitem?agendaitemid=11802) lists US$49,157 for yearly renewals of its B2Gnow system. That is a published US procurement example, not a current vendor list price or a confirmed bill for a small NZ or AU business. Current scope needs a vendor quote. [Selection evidence](docs/research.md).

## Quick start

Node 20 or newer. No vendor account, hosted service or credentials needed for the fictional demo.

```bash
npm install
npm run demo
npm run diversity -- participation
npm run view
npm run docs
```

PGlite stores the local database in .data/db. Set DATABASE_URL for PostgreSQL and run npm run migrate. Use only an empty disposable database with the demo seed. Demo data uses relative dates and is fictional, including its certification scheme and issuers.

The local programme has NZD 10,000 in recorded paid spend, with NZD 3,000 covered by recorded certificate dates: 30 percent. Its NZD 8,000 commitment is separate. An overlapping certificate does not double-count the paid spend. Another programme holds AUD, and a prior-period payment stays outside the current denominator.

This is a trusted-operator tool. Shared deployment requires identity, least privilege, backups and a retention process. Typed actor names provide attribution, not authentication. The database owner can bypass application controls. Public-role access is revoked; shared readers require deliberately granted access.

## The working week

1. /cert-expiry checks certificate evidence before the next review.
2. /participation compares paid-spend evidence coverage with the internal target.
3. /exceptions identifies missing certificates and payments outside the reporting period.
4. /attention names overdue reporting and follow-up work.
5. /weekly-review writes the programme brief from current records.

32 command recipes live in .claude/commands, excluding its README. The one CLI has 27 verbs including help. `npm run diversity -- help` lists every argument. Read commands return aligned text by default or --json. Names match without case. Unique ID prefixes work. Ambiguous matches list candidates and exit 1. /customise extends the system through a tested migration; /new-view adds a read-only report.

## Bring B2Gnow records across

Export the relevant reports from your B2Gnow account. Its report columns vary with the selected report and configuration. The import uses an explicit manifest that maps those actual columns, reconciled counts and source instance. Export to CSV where available, or save a permitted Excel report as UTF-8 CSV. This is not an undocumented promise of a universal B2Gnow header format.

```bash
npm run diversity -- import b2gnow --manifest=imports/manifest.json --actor="Actual operator" --dry-run
npm run diversity -- import b2gnow --manifest=imports/manifest.json --actor="Actual operator"
```

One import accepts suppliers, programmes, certificates, commitments and paid-spend reports in dependency order. It writes them atomically. Identical evidence is skipped, conflicting evidence is refused, and any failure rolls back the entire bundle. Source instances remain separate. Paid amounts use integer cents and must match the programme currency. Read [the switching guide](docs/replace-b2gnow.md), map and reconcile the export before relying on it. Allow one day for a prepared, reconciled bundle; the shape and completeness of the real exports determine the work.

## Ten questions to ask

Each question maps to a shipped query. These are not claims that B2Gnow cannot answer the same question. Your locally assigned follow-ups and review evidence add business context.

1. Which programmes have paid spend without dated certificate evidence? Use participation.
2. Which certificates expire within the next month? Use cert-expiry.
3. Which payments fall outside the reporting period? Use exceptions.
4. Which supplier records need an accuracy review? Use compliance.
5. Which supplier records need a retention review? Use compliance.
6. What have we committed compared with what we have actually paid? Use participation and commitments.
7. Who owns each overdue follow-up? Use attention.
8. Who reviewed the evidence for a supplier? Use supplier and certificates.
9. Which extracts were loaded, and were their counts reconciled? Use imports.
10. Who recorded or closed a programme action? Use history and actions.

## What the evidence share means

Total paid spend includes loaded positive payments within the programme's start and end dates, inclusive. The numerator includes those payments where at least one recorded certificate has the programme's exact scheme and covers the paid date, inclusive. Overlapping certificates count once. Certificates reflect operator-supplied evidence, not a live issuer verification. Missing imports remain unknown; a manifest records declared counts, not proof of completeness. A zero denominator yields an unknown share, not zero percent. The internal goal is stored in basis points: 4000 means 40 percent.

This metric is not statutory DBE, MBE or WBE participation credit. Certification timing, commercially useful function, eligible work, special counting rules and current programme requirements need an authorised specialist. This base does not make certification decisions, submit regulatory returns, run payroll, transfer payments, or replace an external certification directory. The accounting system remains the source of payment evidence. Negative payments and reversals need a reviewed correction design; never disguise a refund as positive spend.

## Documents and views

npm run docs renders a participation evidence brief per programme and an evidence review per supplier into docs-out. npm run view renders views/week.html. All use brand.json and escape record text. The reports are private working papers. /draft-review writes a new private HTML file under drafts and refuses overwrites. [Why no front end](docs/why-no-front-end.md).

## Your first hour: ten things to ask for

1. Set our name, colours and logo in brand.json.
2. Register our actual supplier report source.
3. Agree the records we need and the people allowed to see them.
4. Set our accuracy and retention review dates.
5. Define one internal programme, period, currency and scheme.
6. Map and reconcile our exported supplier report.
7. Run the import check without writing.
8. Load certificate evidence and paid records with source references.
9. Assign the first missing-evidence follow-up.
10. Write the report our weekly review needs.

## Controls and validation

/compliance checks accuracy review dates, retention review dates, missing dated evidence and reporting-period exceptions. [Source rules and limits](docs/compliance.md). A clean check does not certify compliance. Keep ownership evidence and personal details under controlled access; this base needs no personal demographic attributes. Never infer a person's ethnicity, gender or eligibility from a name.

Source records, certificate evidence, commitments, spend, notes and activity are append-only, except supplier review dates and action closure through the CLI. Corrections and deletion follow a reviewed maintenance migration, including retention decisions. Keep original exports under the agreed retention policy.

`npm run diversity -- export --file=exports/backup-YYYY-MM-DD.json` exports all nine record types to a new private JSON file and refuses overwrites. Automatic JSON restore is not included. Keep native database backups and test their restore process.

npm test isolates a temporary PGlite database and exercises every CLI verb, import rollback, source separation, repeated evidence, currency checks, certificate boundaries, privacy review findings, drafts and escaped reports. TEST_DATABASE_URL is only for a disposable empty database. [Validation evidence](docs/validation.md).

Built and optionally operated through [Omni by Enterprise DNA](https://enterprisedna.co/omni/instead-of/b2gnow?utm_source=github&utm_medium=readme&utm_campaign=b2gnow).
