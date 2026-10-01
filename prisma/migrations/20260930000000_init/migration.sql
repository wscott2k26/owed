-- Owed initial production schema (PostgreSQL)
CREATE TYPE "InvoiceStatus" AS ENUM ('open', 'reminded', 'escalated', 'paused', 'paid', 'disputed');
CREATE TYPE "Channel" AS ENUM ('email', 'sms');
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'edited', 'snoozed');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "businessName" TEXT,
  "passwordHash" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "stripeEventAt" TIMESTAMP(3),
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'trialing',
  "trialEndsAt" TIMESTAMP(3),
  "plan" TEXT NOT NULL DEFAULT 'starter',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "toneDial" INTEGER NOT NULL DEFAULT 50,
  "toneMemory" TEXT,
  "smsConsentAt" TIMESTAMP(3),
  "smsConsentSource" TEXT,
  "smsOptOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'open',
  "notes" TEXT,
  "pausedAt" TIMESTAMP(3),
  "lastReplyAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReminderEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "stage" INTEGER NOT NULL,
  "channel" "Channel" NOT NULL,
  "templateKey" TEXT NOT NULL,
  "tone" INTEGER NOT NULL,
  "providerId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "result" TEXT,
  CONSTRAINT "ReminderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EscalationPolicy" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default',
  "stages" JSONB NOT NULL,
  CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Approval" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stage" INTEGER NOT NULL,
  "channel" "Channel" NOT NULL,
  "templateKey" TEXT NOT NULL,
  "tone" INTEGER NOT NULL,
  "draftBody" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
  "snoozedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "Customer_userId_idx" ON "Customer"("userId");
CREATE INDEX "Customer_userId_email_idx" ON "Customer"("userId", "email");
CREATE INDEX "Customer_userId_phone_idx" ON "Customer"("userId", "phone");
CREATE UNIQUE INDEX "Invoice_userId_number_key" ON "Invoice"("userId", "number");
CREATE INDEX "Invoice_userId_status_idx" ON "Invoice"("userId", "status");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");
CREATE UNIQUE INDEX "ReminderEvent_invoiceId_stage_key" ON "ReminderEvent"("invoiceId", "stage");
CREATE INDEX "ReminderEvent_invoiceId_idx" ON "ReminderEvent"("invoiceId");
CREATE INDEX "EscalationPolicy_userId_idx" ON "EscalationPolicy"("userId");
CREATE UNIQUE INDEX "Approval_invoiceId_stage_key" ON "Approval"("invoiceId", "stage");
CREATE INDEX "Approval_userId_status_idx" ON "Approval"("userId", "status");
CREATE INDEX "Approval_invoiceId_idx" ON "Approval"("invoiceId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderEvent" ADD CONSTRAINT "ReminderEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscalationPolicy" ADD CONSTRAINT "EscalationPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
