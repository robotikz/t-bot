# GCP Setup Troubleshooting

This document tracks errors encountered during GCP bootstrap and their resolutions.

## Setup Process

Run the setup script:
```bash
cd /home/jo/trading/t-bot
bash docs/deployment/gcp-setup.sh
```

## Known Issues & Fixes

### Issue: `gcloud: command not found`
**Fix:** Install Google Cloud CLI
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init
```

### Issue: Billing account not found
**Fix:** Create one at https://console.cloud.google.com/billing
Then link it as prompted in the setup script.

### Issue: `ERROR: (gcloud.iam.service-accounts.create) The service account ID exceeds 30 characters`
**Fix:** Shorten `DEPLOY_SA_ID` or `RUNTIME_SA_ID` in the script.
Edit the script and use shorter names like `gh-deployer` instead of `github-deployer`.

### Issue: Permission denied on Firebase commands
**Fix:** Ensure billing is linked to the project before running Firebase commands.

### Issue: Artifact Registry creation fails with "already exists"
**Fix:** This is expected if you re-run the script. It's handled with `|| true`.

### Issue: `ERROR: (gcloud) Invalid choice: 'billing'`
**Cause:** Billing API is not enabled or user lacks billing permissions.
**Fix:**
1. Ensure you're logged in as the account owner or have Billing Admin role.
2. Enable the Billing API:
```bash
gcloud services enable cloudbilling.googleapis.com
```
3. Then retry:
```bash
gcloud billing accounts list
```
If still fails, create a billing account manually at https://console.cloud.google.com/billing and note the ACCOUNT_ID.

## Errors Encountered (update as you run)

Report errors here with:
1. Full error message
2. Step number where it occurred
3. Any additional context

### Error Log

**Encountered in Step 3/4:**
- Error: `ERROR: (gcloud) Invalid choice: 'billing'` or `Billing account for project is not found`
- Cause: Billing account not linked to project despite being available
- Resolution:
  1. Go to https://console.cloud.google.com/billing
  2. Click **Link a Billing Account**
  3. Select project `t-bot-dev1`
  4. Select billing account `01D3A8-A2752B-2610D4`
  5. Confirm the link
  6. Wait 1-2 minutes for propagation
  7. Retry API enablement command
