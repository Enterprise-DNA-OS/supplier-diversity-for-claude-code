# Supplier programme record controls

Reviewed 19 November 2026. These checks find operational record gaps. They do not certify legal compliance, decide supplier eligibility or calculate statutory participation credit.

| Rule | Source | Implemented check | Limit |
|---|---|---|---|
| ACCURACY | [NZ Privacy Commissioner, Principle 8](https://www.privacy.org.nz/privacy-principles/8/) | Flags suppliers whose operator-set accuracy review date has passed. | The law requires reasonable accuracy checks before use or disclosure. The review date is our workflow, not a statutory interval or proof the record is accurate. |
| RETENTION | [NZ Privacy Commissioner, Principle 9](https://www.privacy.org.nz/privacy-principles/9/) | Flags suppliers whose operator-set retention review date has passed. | The law limits retention to the period needed for the lawful purpose. The check triggers review; it neither invents a retention period nor deletes evidence. |
| EVIDENCE | [B2Gnow vendor management](https://b2gnow.com/solutions/vendor-management-software/) and the operator's documented internal programme | Flags recorded payments with no certificate covering the paid date and programme scheme. | An internal completeness check, not statutory counting. The issuer and named reviewer are recorded, not independently verified. |
| PERIOD | Operator's recorded reporting period | Flags payments outside the programme's start and end dates. | An internal reconciliation control. Missing payments outside the extract remain unknown. |

Run `npm run diversity -- compliance`. Certificate expiry within 30 days is an operational reminder in cert-expiry and attention, not a legal notice deadline. Amounts and internal goals stay separate for each programme and currency.

US DBE counting has rules beyond holding a dated certificate. The [US Department of Transportation's official questions and answers](https://www.transportation.gov/civil-rights/disadvantaged-business-enterprise/questions-and-answers-dbe-program_part26) describe certification and commercially useful function requirements. The [25 September 2026 Federal Register rule](https://www.govinfo.gov/content/pkg/FR-2026-09-25/html/2026-19688.htm) also addresses counting during reevaluation. This base deliberately reports only internal evidence coverage. It implements no US DBE statutory credit engine. An authorised specialist must check the current rules and programme status before making or filing any regulatory determination.

Do not store personal demographic attributes unless the operator has established a lawful need and controls. This base needs business references and certificate evidence only. Never infer gender, ethnicity or certification eligibility from names. Review exported reports and working papers for personal information. Identity and access, retention decisions and secure backup storage remain deployment responsibilities.

Built and optionally operated through Omni by Enterprise DNA.
