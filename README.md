# Stripe Notification Construct for AWS CDK

Stripe決済通知をSlackに送信するためのAWS CDK Constructライブラリです。StripeのEventBridgeイベントを受け取り、AWS Chatbot経由でSlackに通知を送信します。

## 特徴

- Stripe決済完了時に自動でSlack通知
- AWS EventBridgeとの統合
- テスト環境と本番環境の切り替え対応
- TypeScript完全対応
- カスタマイズ可能なLambda設定

## 対応イベント

- `checkout.session.completed` - チェックアウトセッション完了時
- `checkout.session.async_payment_succeeded` - 非同期決済成功時

## インストール

```bash
npm install @your-org/stripe-notifications-construct
```

または

```bash
yarn add @your-org/stripe-notifications-construct
```

## 使用方法

### 基本的な使い方

```typescript
import * as cdk from 'aws-cdk-lib';
import { StripeNotificationConstruct } from '@your-org/stripe-notifications-construct';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

new StripeNotificationConstruct(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeAccountName: 'MyCompany',
});
```

### 開発環境での使用例

```typescript
new StripeNotificationConstruct(stack, 'StripeNotificationDev', {
  environment: 'development',
  snsTopicArn: process.env.SNS_TOPIC_ARN!,
  stripeSecretKey: process.env.STRIPE_TEST_SECRET_KEY!,
  stripeAccountName: 'MyCompany (Test)',
  stripeSandboxAccountId: process.env.STRIPE_SANDBOX_ACCOUNT_ID,
});
```

### Lambda関数のカスタマイズ

```typescript
new StripeNotificationConstruct(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeAccountName: 'MyCompany',
  lambdaOptions: {
    timeout: cdk.Duration.seconds(60),
    memorySize: 512,
    logRetention: logs.RetentionDays.ONE_WEEK,
  },
});
```

## セットアップ手順

### 1. Stripe EventBridgeの設定

StripeダッシュボードでEventBridgeとの連携を設定してください：

1. [Stripe Dashboard](https://dashboard.stripe.com) にログイン
2. **Developers** > **Webhooks** > **Add destination** を選択
3. **Amazon EventBridge** を選択
4. AWSアカウントIDとリージョンを入力
5. 送信するイベントを選択：
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`

### 2. AWS Chatbotの設定

Slackへの通知を受け取るためにAWS Chatbotを設定してください：

1. [AWS Chatbot Console](https://console.aws.amazon.com/chatbot/) を開く
2. **Configure new client** でSlackワークスペースを連携
3. **Configure new channel** でSlackチャンネルを設定
4. SNS Topicを作成し、ChatbotのチャンネルにSNS Topicを関連付け
5. 作成したSNS TopicのARNをメモ（このConstructで使用します）

### 3. 環境変数の設定

以下の環境変数を設定してください：

**本番環境:**
```bash
export STRIPE_SECRET_KEY="sk_live_xxxxxxxxxxxxx"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic"
export STRIPE_ACCOUNT_NAME="MyCompany"
```

**開発環境:**
```bash
export STRIPE_TEST_SECRET_KEY="sk_test_xxxxxxxxxxxxx"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic-dev"
export STRIPE_ACCOUNT_NAME="MyCompany (Test)"
export STRIPE_SANDBOX_ACCOUNT_ID="acct_xxxxxxxxxxxxx"
```

### 4. 鍵の管理について

#### Stripe Secret Key の取得方法

1. [Stripe Dashboard](https://dashboard.stripe.com) にログイン
2. **Developers** > **API keys** を選択
3. **Secret key** をコピー
   - テスト環境: `sk_test_` で始まるキー
   - 本番環境: `sk_live_` で始まるキー

**⚠️ セキュリティ上の注意事項:**

- **Secret Keyは絶対にGitにコミットしないでください**
- 環境変数やAWS Secrets Managerで管理してください
- `.env`ファイルは`.gitignore`に追加してください
- 本番環境では必ずAWS Secrets Managerの使用を推奨します

#### AWS Secrets Managerを使用した例

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

const stripeSecretKey = secretsmanager.Secret.fromSecretNameV2(
  stack,
  'StripeSecret',
  'stripe/secret-key'
);

new StripeNotificationConstruct(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: stripeSecretKey.secretValue.unsafeUnwrap(),
  stripeAccountName: 'MyCompany',
});
```

### 5. EventBridgeルールの設定

このConstructで作成されたLambda関数をEventBridgeルールのターゲットに設定します：

```typescript
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const construct = new StripeNotificationConstruct(stack, 'StripeNotification', {
  // ... props
});

const rule = new events.Rule(stack, 'StripeEventRule', {
  eventPattern: {
    source: ['aws.partner/stripe.com'],
    detailType: [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
    ],
  },
});

rule.addTarget(new targets.LambdaFunction(construct.lambdaFunction));
```

## Props

### StripeNotificationConstructProps

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `environment` | `string` | ✅ | デプロイ環境 (例: `development`, `production`) |
| `snsTopicArn` | `string` | ✅ | Slack通知を送信するSNS TopicのARN |
| `stripeSecretKey` | `string` | ✅ | StripeのSecret Key (本番用またはテスト用) |
| `stripeAccountName` | `string` | ✅ | Stripeアカウント名（通知メッセージに表示） |
| `stripeSandboxAccountId` | `string` | ❌ | StripeサンドボックスアカウントID（テスト環境の場合） |
| `lambdaOptions` | `Partial<NodejsFunctionProps>` | ❌ | Lambda関数の追加設定 |

## 通知内容

Slackに送信される通知には以下の情報が含まれます：

- Checkout Session ID
- Payment Intent ID
- 注文詳細（商品名、数量、金額など）
- Stripeダッシュボードへのリンク
- イベントタイプ
- 環境情報（テスト/本番）

## 開発

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

### ローカル開発

```bash
npm run watch
```

## サンプルコード

詳細なサンプルコードは[examples](./examples)ディレクトリを参照してください。

## ライセンス

MIT

## サポート

問題が発生した場合は、[GitHub Issues](https://github.com/your-org/lambda-stripe-notifications/issues)で報告してください。

## 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。
