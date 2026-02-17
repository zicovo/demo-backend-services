# Demo Backend Services

Mock services for:
- Identity verification (IDV)
- Payments (direct debit update)
- Case management (dispute creation)

## OpenAPI
See `/openapi`.

## Cross-cutting conventions (required)

### Correlation ID
- Every request MUST carry a correlation ID in the `x-correlation-id` header.
- Services MUST echo `x-correlation-id` in responses.

> Note: the IDV endpoint also accepts `correlation_id` in the JSON body for demo convenience, but the header is still required.

### Verification token (hard guardrail)
- `POST /payments/direct-debit` is a sensitive mutation.
- APIM MUST reject requests that do not include `x-verification-token` with `403 Forbidden` and `code=verification_required`.

### Response shape
- Error responses are JSON in the form: `{ "code": "...", "message": "..." }`.
