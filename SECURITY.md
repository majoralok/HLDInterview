# Security policy

Please report vulnerabilities privately to the repository owner instead of opening a public issue.

Never include API keys, access tokens, candidate answers, or deployment credentials in a report. If an OpenAI key may have been exposed, revoke it immediately, replace the hosted secret, and review project usage.

The AI endpoint is designed for authenticated/private or low-volume personal deployments. Public deployments should add durable distributed rate limiting, authenticated quotas, abuse monitoring, and an explicit data-retention policy.
