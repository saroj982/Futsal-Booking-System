# Legacy backend structure

This folder is an archive note for the old top-level CommonJS backend layout.

## Canonical source of truth

Use `Backend/src/` for all active code:
- `src/config/`
- `src/constants/`
- `src/controllers/`
- `src/middleware/`
- `src/models/`
- `src/routes/`
- `src/services/`
- `src/utils/`

## Runtime entrypoint

The app now boots from `Backend/index.js` using ESM imports and routes everything through `src/`.

## Legacy folders

The top-level folders below are historical and should not be used for new work:
- `Backend/controllers/`
- `Backend/middleware/`
- `Backend/models/`
- `Backend/routes/`
- `Backend/services/`

If you want, these can later be moved into this archive area one-by-one after confirming nothing still depends on them.
