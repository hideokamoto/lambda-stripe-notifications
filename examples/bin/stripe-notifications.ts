#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StripeNotificationsStack } from "../lib/stripe-notifications-stack";
import * as dotenv from "dotenv";

dotenv.config();

const app = new cdk.App();
const environment = app.node.tryGetContext("environment") || "dev";
new StripeNotificationsStack(app, `StripeNotificationsStack-${environment}`, {
  environment,
  env: {
    account: process.env.AWS_ACCOUNT,
    region: process.env.AWS_REGION,
  },
  tags: {
    Environment: environment,
    Project: "Backend-app",
  },
});
