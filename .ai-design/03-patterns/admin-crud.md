# Pattern — Admin CRUD

## Required
- list
- filter/search
- create
- edit
- delete/disable
- validation
- audit/status metadata when available

## Rules
- Never fake save success.
- Dangerous operations require confirmation.
- Permission model must be visible to admin users where relevant.
