import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda_nodejs, aws_iam } from 'aws-cdk-lib';
import { join } from 'path'

export class StripeNotificationsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps & {
    environment: string
  }) {
    super(scope, id, props);
    const lambdaFunction = new aws_lambda_nodejs.NodejsFunction(this, `StripeWebhookForCheckout-${props?.environment}`, {
      entry: join(__dirname, '../lambda/checkout-session.ts'),
      handler: 'handler',
      environment: {
        APP_ENV: props?.environment || 'dev',
        SNS_TOPIC_ARN: process.env.SLACK_NOTIFICATION_SNS_ARN as string,
        STRIPE_SECRET_KEY: (props?.environment === 'production' ? process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_TEST_SECRET_KEY) as string,
        STRIPE_ACCOUNT_NAME: process.env.STRIPE_ACCOUNT_NAME as string,
        STRIPE_SANDBOX_ACCOUNT_ID: process.env.STRIPE_SANDBOX_ACCOUNT_ID as string,
      }
    });

    lambdaFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: [process.env.SLACK_NOTIFICATION_SNS_ARN as string],
    }));
  }
}
