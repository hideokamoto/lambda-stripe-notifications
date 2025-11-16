# 使用例

このディレクトリには、Stripe Notification Constructの使用例が含まれています。

## サンプルファイル

### simple-usage.ts

最もシンプルな使用例です。Constructを直接使用してLambda関数を作成します。

```bash
# 実行方法
cd examples
npx ts-node simple-usage.ts
```

### bin/stripe-notifications.ts

元のCDKアプリケーションの例です。環境変数を使用した設定方法が含まれています。

## セットアップ

### 1. 環境変数の設定

`.env.example`を参考に、`.env`ファイルを作成してください：

```bash
cp ../.env.example .env
```

環境変数を編集：

```
STRIPE_TEST_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_LIVE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_ACCOUNT_NAME=YourCompanyName
STRIPE_SANDBOX_ACCOUNT_ID=acct_xxxxxxxxxxxxx
SLACK_NOTIFICATION_SNS_ARN=arn:aws:sns:us-west-2:123456789:your-topic
AWS_ACCOUNT=123456789012
AWS_REGION=us-west-2
```

### 2. デプロイ

開発環境へのデプロイ：

```bash
npm run deploy:dev
```

本番環境へのデプロイ：

```bash
npm run deploy:prod
```

## より高度な使用例

### EventBridgeルールと組み合わせる

> **⚠️ セキュリティ推奨**: 本番環境ではSecrets ManagerまたはSSM Parameter Storeを使用してください

```typescript
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { StripeNotificationConstruct } from '@your-org/stripe-notifications-construct';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'StripeStack');

// Constructを作成（Secrets Manager使用）
const notification = new StripeNotificationConstruct(stack, 'Notification', {
  environment: 'production',
  snsTopicArn: process.env.SNS_TOPIC_ARN!,
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
});

// EventBridgeルールを作成
const rule = new events.Rule(stack, 'StripeEventRule', {
  eventPattern: {
    source: ['aws.partner/stripe.com'],
    detailType: [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
    ],
  },
});

// Lambda関数をターゲットに追加
rule.addTarget(new targets.LambdaFunction(notification.lambdaFunction));

app.synth();
```

### 複数の環境を同時にデプロイ

> **⚠️ セキュリティ推奨**: 本番環境ではSecrets ManagerまたはSSM Parameter Storeを使用してください

```typescript
import * as cdk from 'aws-cdk-lib';
import { StripeNotificationConstruct } from '@your-org/stripe-notifications-construct';

const app = new cdk.App();

// 開発環境用のStack（SSM Parameter Store使用）
const devStack = new cdk.Stack(app, 'StripeNotificationDev', {
  env: { account: process.env.AWS_ACCOUNT, region: 'us-west-2' },
  tags: { Environment: 'development' },
});

new StripeNotificationConstruct(devStack, 'Notification', {
  environment: 'development',
  snsTopicArn: process.env.SNS_TOPIC_ARN_DEV!,
  stripeSecretKeyFromSsmParameter: {
    parameterName: '/stripe/test/secret-key',
  },
  stripeAccountName: 'MyCompany (Dev)',
  stripeSandboxAccountId: process.env.STRIPE_SANDBOX_ACCOUNT_ID,
});

// 本番環境用のStack（Secrets Manager使用）
const prodStack = new cdk.Stack(app, 'StripeNotificationProd', {
  env: { account: process.env.AWS_ACCOUNT, region: 'us-west-2' },
  tags: { Environment: 'production' },
});

new StripeNotificationConstruct(prodStack, 'Notification', {
  environment: 'production',
  snsTopicArn: process.env.SNS_TOPIC_ARN_PROD!,
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/live/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
});

app.synth();
```

### カスタムログ設定

> **⚠️ セキュリティ推奨**: 本番環境ではSecrets ManagerまたはSSM Parameter Storeを使用してください

```typescript
import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { StripeNotificationConstruct } from '@your-org/stripe-notifications-construct';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'StripeStack');

new StripeNotificationConstruct(stack, 'Notification', {
  environment: 'production',
  snsTopicArn: process.env.SNS_TOPIC_ARN!,
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  lambdaOptions: {
    timeout: cdk.Duration.seconds(60),
    memorySize: 512,
    logRetention: logs.RetentionDays.ONE_MONTH,
    reservedConcurrentExecutions: 5,
  },
});

app.synth();
```
