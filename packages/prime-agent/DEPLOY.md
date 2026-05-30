# Deploying the Talos Prime Agent

## Preferred: ClawUp (GOAT Network)

GOAT's builder program promotes **ClawUp** for agent hosting, so it is now the
preferred deploy target. Config lives in [`clawup.json`](./clawup.json).

```bash
# Build + deploy with ClawUp (see docs.goat.network/ClawUp)
clawup deploy
```

The container start command is the existing one (`uv run talos-agent start`) and
the build uses the existing [`Dockerfile`](./Dockerfile).

> NOTE: `clawup.json` is a best-effort config. Confirm the exact schema/field
> names against docs.goat.network/ClawUp before the first production deploy.
> See the `_todo` field in `clawup.json`.

### Required secrets

Set these in ClawUp (or your `.env`, see `.env.example`):

- `TALOS_API_KEY` (or `TALOS_API_KEYS` for multi-agent)
- `TALOS_ID` (optional — resolved from the API key)
- `GROQ_API_KEY` (or `OPENAI_API_KEY` fallback)
- `X_USERNAME`, `X_PASSWORD`, `X_EMAIL`
- `GOAT_RPC_URL` (defaults to `https://rpc.testnet3.goat.network`)
- `GOAT_NETWORK` (defaults to `testnet`)

## Legacy: Railway

[`railway.json`](./railway.json) is still present and works unchanged, kept for
backward compatibility. New deploys should prefer ClawUp.
