# Raiseproxy CRM + Outreach

Cloud-hosted Raiseproxy CRM and automated outreach system, built for Cloudflare Workers.

## Architecture

- Cloudflare Workers: app/API runtime
- Workers Static Assets: CRM + Outreach web UI
- SQLite-backed Durable Object: CRM users, leads, claims, tracking, outreach queues and schedules
- Durable Object alarms: scheduled outreach continues even when every office PC is off
- Cloudflare outbound TCP sockets: Gmail / Outlook / Microsoft 365 / Zoho SMTP with TLS/STARTTLS
- GitHub -> Cloudflare Workers Builds: every push can deploy automatically

## Public repository security rule

This repository contains **code only**. The CRM website login protects the deployed application data, but it does not protect files committed to a public GitHub repository.

Never commit:

- customer/lead email databases
- exported CRM data
- users.json / claims.jsonl / tracking files
- SMTP or App Passwords
- cookies, API tokens, private keys or Cloudflare credentials

Production data is stored in Cloudflare persistent storage and is accessed through the CRM login, not from GitHub.

## First deployment

Connect this repository to Cloudflare Workers Builds and deploy the Worker named `raiseproxy-crm`.
The `CRMDatabase` Durable Object is declared in `wrangler.jsonc` with SQLite storage and is provisioned on deployment.

On first visit, the CRM will ask for the initial administrator account. After login, use the admin migration tools to import the legacy CRM data.

## Local development

```bash
npm install
npm run dev
```

## Deployment

```bash
npm run deploy
```
