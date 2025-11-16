import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda_nodejs, aws_iam } from 'aws-cdk-lib';
import { join } from 'path'

export interface StripeNotificationConstructProps {
  /**
   * デプロイ環境 (development, production など)
   */
  readonly environment: string;

  /**
   * Slack通知を送信するSNS TopicのARN
   */
  readonly snsTopicArn: string;

  /**
   * StripeのSecret Key (本番環境用またはテスト用)
   */
  readonly stripeSecretKey: string;

  /**
   * Stripeアカウント名（通知メッセージに表示）
   */
  readonly stripeAccountName: string;

  /**
   * StripeサンドボックスアカウントID（テスト環境の場合）
   * @default - 未設定
   */
  readonly stripeSandboxAccountId?: string;

  /**
   * Lambda関数の追加設定
   * @default - デフォルト設定を使用
   */
  readonly lambdaOptions?: Partial<aws_lambda_nodejs.NodejsFunctionProps>;
}

/**
 * Stripe決済通知をSlackに送信するためのConstruct
 *
 * EventBridgeでStripeイベントを受け取り、AWS Chatbot経由でSlackに通知します。
 */
export class StripeNotificationConstruct extends Construct {
  /**
   * 作成されたLambda関数
   */
  public readonly lambdaFunction: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: StripeNotificationConstructProps) {
    super(scope, id);

    this.lambdaFunction = new aws_lambda_nodejs.NodejsFunction(this, 'Handler', {
      entry: join(__dirname, '../lambda/checkout-session.ts'),
      handler: 'handler',
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      environment: {
        APP_ENV: props.environment,
        SNS_TOPIC_ARN: props.snsTopicArn,
        STRIPE_SECRET_KEY: props.stripeSecretKey,
        STRIPE_ACCOUNT_NAME: props.stripeAccountName,
        STRIPE_SANDBOX_ACCOUNT_ID: props.stripeSandboxAccountId || '',
      },
      ...props.lambdaOptions,
    });

    this.lambdaFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: [props.snsTopicArn],
    }));
  }
}

/**
 * @deprecated StripeNotificationConstructを使用してください
 */
export class StripeNotificationsStack extends cdk.Stack {
  public readonly notificationConstruct: StripeNotificationConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps & {
    environment: string
  }) {
    super(scope, id, props);

    this.notificationConstruct = new StripeNotificationConstruct(this, 'StripeNotification', {
      environment: props?.environment || 'dev',
      snsTopicArn: process.env.SLACK_NOTIFICATION_SNS_ARN as string,
      stripeSecretKey: (props?.environment === 'production'
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_TEST_SECRET_KEY) as string,
      stripeAccountName: process.env.STRIPE_ACCOUNT_NAME as string,
      stripeSandboxAccountId: process.env.STRIPE_SANDBOX_ACCOUNT_ID,
    });
  }
}
