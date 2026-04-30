# Form Validation Skill

## When to Use

Use for admin writes, content CRUD, IAM, monetization, legal/privacy, imports, media metadata, and learner settings.

## Required Checks

- Field labels use i18n.
- Helper text exists for unclear fields.
- Client validation catches obvious errors.
- Server validation errors map to fields or form-level messages.
- Dirty state and disabled submit while saving exist.
- Success and error states are honest.
- Cancel/back behavior is clear.
- Dangerous changes require confirmation.
- Admin writes check permission and backend audit path.

## Anti-Patterns

- Silent validation failure.
- Generic "something went wrong" when field mapping is available.
- Submitting multiple times while saving.
- Admin mutation without audit reason where required.
- Frontend-only validation for security/business rules.

## Output Checklist

- fields and validation rules listed
- server error mapping noted
- save/cancel/dirty behavior noted
- audit/permission behavior noted

