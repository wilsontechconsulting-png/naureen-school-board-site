# Naureen Stack-Frierdich for Columbia School Board

Astro campaign website starter for Naureen Stack-Frierdich's Columbia, IL school board re-election campaign.

## Commands

```bash
npm install
npm run dev
npm run build
```

## GitHub Pages

This project includes a GitHub Actions workflow at `.github/workflows/deploy.yml`.

Before launch, set these repository variables if needed:

- `SITE_URL` - final public URL
- `BASE_PATH` - repository path for GitHub Pages project sites, such as `/naureen-school-board-site/`

## Contact Form

The "Questions? Let's Talk." form posts to the secure Sites Worker endpoint at `/api/contact`. The Worker sends notification emails through Resend.

Production environment variables:

```bash
RESEND_API_KEY=
RESEND_FROM_EMAIL="Reelect Naureen for Columbia School Board <onboarding@resend.dev>"
CONTACT_TO_EMAIL="naureen@crossroads-realtygroup.com"
CONTACT_BCC_EMAIL="wilsontech.consulting@gmail.com"
```

Use a verified campaign-domain sender in `RESEND_FROM_EMAIL` when one is available.

## Content To Confirm

- Candidate full name
- District naming
- Election date
- Required campaign disclaimer
- Final bio, priorities, and photos
