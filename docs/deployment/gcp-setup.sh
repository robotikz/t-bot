#!/bin/bash
# GCP Bootstrap Setup Script for t-bot Phase 1 Deployment
# This script sets up all required GCP infrastructure for deploying scanner + web
# Run step-by-step and report errors as you encounter them

set -e

echo "=========================================="
echo "Step 1: Authenticate to Google Cloud"
echo "=========================================="
gcloud auth login
gcloud auth list

echo ""
echo "=========================================="
echo "Step 2: Create fresh project"
echo "=========================================="
export PROJECT_ID="t-bot-dev1"
echo "Creating project: $PROJECT_ID"
gcloud projects create "$PROJECT_ID" --name="Trading Bot Dev"
gcloud config set project "$PROJECT_ID"
gcloud config get-value project
echo "Project ID: $PROJECT_ID"

echo ""
echo "=========================================="
echo "Step 3: Link billing account"
echo "=========================================="
echo "MANUAL STEP REQUIRED:"
echo "1. Go to: https://console.cloud.google.com/billing"
echo "2. Link or create a billing account"
echo "3. Copy the ACCOUNT_ID from the billing account list"
echo "4. Run this command:"
echo ""
echo "  export BILLING_ACCOUNT_ID='YOUR_ACCOUNT_ID'"
echo "  gcloud billing projects link $PROJECT_ID --billing-account=\"\$BILLING_ACCOUNT_ID\""
echo ""
read -p "Press enter after billing is linked to $PROJECT_ID..."
echo "Verifying billing link..."
gcloud billing projects describe "$PROJECT_ID" || echo "Warning: Could not verify billing link, but continuing..."

echo ""
echo "=========================================="
echo "Step 4: Enable required APIs"
echo "=========================================="
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  firebase.googleapis.com \
  firebasehosting.googleapis.com

echo "APIs enabled. Waiting 30 seconds for propagation..."
sleep 30

echo ""
echo "=========================================="
echo "Step 5: Full setup (services, IAM, WIF)"
echo "=========================================="
export REGION="europe-west2"
export GAR_REPOSITORY="api"
export SCANNER_RUN_SERVICE="bybit-market-scanner"
export GITHUB_OWNER="robotikz"
export GITHUB_REPO="t-bot"
export WIF_POOL_ID="github-pool"
export WIF_PROVIDER_ID="github-provider"
export DEPLOY_SA_ID="github-deployer"
export RUNTIME_SA_ID="scanner-runtime"

export PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
echo "PROJECT_NUMBER=$PROJECT_NUMBER"

# Artifact Registry
echo "Creating Artifact Registry..."
gcloud artifacts repositories create "$GAR_REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Docker images for t-bot" || echo "Repository may already exist"

# Service Accounts
echo "Creating service accounts..."
gcloud iam service-accounts create "$DEPLOY_SA_ID" \
  --display-name="GitHub deployer" || echo "Service account may already exist"

gcloud iam service-accounts create "$RUNTIME_SA_ID" \
  --display-name="Scanner runtime" || echo "Service account may already exist"

export DEPLOY_SA_EMAIL="${DEPLOY_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"
export RUNTIME_SA_EMAIL="${RUNTIME_SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "DEPLOY_SA_EMAIL=$DEPLOY_SA_EMAIL"
echo "RUNTIME_SA_EMAIL=$RUNTIME_SA_EMAIL"

# IAM Roles
echo "Assigning IAM roles..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/firebase.admin"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding "${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Workload Identity Federation
echo "Setting up Workload Identity Federation..."
gcloud iam workload-identity-pools create "$WIF_POOL_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --display-name="GitHub pool" || echo "WIF Pool may already exist"

gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER_ID" \
  --project="$PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$WIF_POOL_ID" \
  --display-name="GitHub provider" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='${GITHUB_OWNER}/${GITHUB_REPO}'" || echo "WIF Provider may already exist"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

export GCP_WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL_ID}/providers/${WIF_PROVIDER_ID}"
echo "GCP_WIF_PROVIDER=$GCP_WIF_PROVIDER"

echo ""
echo "=========================================="
echo "Step 6: Firebase Setup"
echo "=========================================="
echo "Installing firebase-tools..."
npm install -g firebase-tools

echo "Logging in to Firebase..."
firebase login

echo "Enabling Firebase on project..."
firebase projects:addfirebase "$PROJECT_ID"

echo ""
echo "=========================================="
echo "SETUP COMPLETE"
echo "=========================================="
echo ""
echo "Save these GitHub repository variables:"
echo ""
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_REGION=$REGION"
echo "GAR_REPOSITORY=$GAR_REPOSITORY"
echo "SCANNER_RUN_SERVICE=$SCANNER_RUN_SERVICE"
echo "GCP_RUNTIME_SA_EMAIL=$RUNTIME_SA_EMAIL"
echo "GCP_WIF_PROVIDER=$GCP_WIF_PROVIDER"
echo "GCP_DEPLOY_SA_EMAIL=$DEPLOY_SA_EMAIL"
echo ""
echo "Next: Set these as GitHub Actions variables in:"
echo "https://github.com/$GITHUB_OWNER/$GITHUB_REPO/settings/variables/actions"
