import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StripeNotificationConstruct } from '../lib';

describe('StripeNotificationConstruct', () => {
  let app: cdk.App;
  let stack: cdk.Stack;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, 'TestStack');
  });

  test('Lambda関数が作成されること', () => {
    // WHEN
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'test',
      snsTopicArn: 'arn:aws:sns:us-west-2:123456789:test-topic',
      stripeSecretKey: 'sk_test_123',
      stripeAccountName: 'TestAccount',
    });

    // THEN
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::Lambda::Function', 1);
  });

  test('Lambda関数に正しい環境変数が設定されること', () => {
    // WHEN
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'production',
      snsTopicArn: 'arn:aws:sns:us-west-2:123456789:prod-topic',
      stripeSecretKey: 'sk_live_456',
      stripeAccountName: 'ProdAccount',
      stripeSandboxAccountId: 'acct_test',
    });

    // THEN
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          APP_ENV: 'production',
          SNS_TOPIC_ARN: 'arn:aws:sns:us-west-2:123456789:prod-topic',
          STRIPE_SECRET_KEY: 'sk_live_456',
          STRIPE_ACCOUNT_NAME: 'ProdAccount',
          STRIPE_SANDBOX_ACCOUNT_ID: 'acct_test',
        },
      },
    });
  });

  test('Lambda関数にSNS Publishの権限が付与されること', () => {
    // WHEN
    const snsTopicArn = 'arn:aws:sns:us-west-2:123456789:test-topic';
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'test',
      snsTopicArn,
      stripeSecretKey: 'sk_test_123',
      stripeAccountName: 'TestAccount',
    });

    // THEN
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: [
          {
            Action: 'sns:Publish',
            Effect: 'Allow',
            Resource: snsTopicArn,
          },
        ],
      },
    });
  });

  test('Lambda関数のランタイムがNode.js 20であること', () => {
    // WHEN
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'test',
      snsTopicArn: 'arn:aws:sns:us-west-2:123456789:test-topic',
      stripeSecretKey: 'sk_test_123',
      stripeAccountName: 'TestAccount',
    });

    // THEN
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
    });
  });

  test('Lambda関数のタイムアウトが30秒であること', () => {
    // WHEN
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'test',
      snsTopicArn: 'arn:aws:sns:us-west-2:123456789:test-topic',
      stripeSecretKey: 'sk_test_123',
      stripeAccountName: 'TestAccount',
    });

    // THEN
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 30,
    });
  });

  test('lambdaOptionsでカスタム設定を上書きできること', () => {
    // WHEN
    new StripeNotificationConstruct(stack, 'TestConstruct', {
      environment: 'test',
      snsTopicArn: 'arn:aws:sns:us-west-2:123456789:test-topic',
      stripeSecretKey: 'sk_test_123',
      stripeAccountName: 'TestAccount',
      lambdaOptions: {
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
      },
    });

    // THEN
    const template = Template.fromStack(stack);
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 60,
      MemorySize: 512,
    });
  });
});
