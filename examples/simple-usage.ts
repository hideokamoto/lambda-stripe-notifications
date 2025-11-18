#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StripeNotificationConstruct } from "../lib";

const app = new cdk.App();

const stack = new cdk.Stack(app, "StripeNotificationStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

// Constructを直接使用する例
new StripeNotificationConstruct(stack, "StripeNotification", {
  environment: "production",
  snsTopicArn: "arn:aws:sns:us-west-2:123456789:my-slack-topic",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeAccountName: "MyCompany",
  stripeSandboxAccountId: process.env.STRIPE_SANDBOX_ACCOUNT_ID,
});

app.synth();
