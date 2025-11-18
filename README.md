# Stripe Notification Construct for AWS CDK

Stripe決済通知をSlackに送信するためのAWS CDK Constructライブラリです。StripeのEventBridgeイベントを受け取り、AWS Chatbot経由でSlackに通知を送信します。

## 特徴

- Stripe決済完了時に自動でSlack通知
- AWS EventBridgeとの統合
- テスト環境と本番環境の切り替え対応
- 日本語・英語の通知メッセージに対応
- TypeScript完全対応
- カスタマイズ可能なLambda設定

## 対応イベント

- `checkout.session.completed` - チェックアウトセッション完了時
- `checkout.session.async_payment_succeeded` - 非同期決済成功時

## インストール

```bash
npm install cdk-stripe-slack-notification
```

または

```bash
yarn add cdk-stripe-slack-notification
```

## 使用方法

### 🔒 推奨: AWS Secrets Managerを使用する方法

セキュリティのベストプラクティスとして、Secrets Managerの使用を推奨します：

```typescript
import * as cdk from 'aws-cdk-lib';
import { StripeCheckoutHandler } from 'cdk-stripe-slack-notification';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'ja', // または 'en' で英語メッセージ
});
```

JSONシークレットから特定のキーを取得する場合：

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:app-secrets-abc123',
    secretKey: 'STRIPE_SECRET_KEY', // JSON内のキー名
  },
  stripeAccountName: 'MyCompany',
});
```

### 🔒 推奨: SSM Parameter Storeを使用する方法

コスト効率を重視する場合は、SSM Parameter Store（SecureString）を使用できます：

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSsmParameter: {
    parameterName: '/stripe/secret-key',
  },
  stripeAccountName: 'MyCompany',
});
```

### ⚠️ 非推奨: 環境変数から直接指定する方法

> **警告**: セキュリティ上のリスクがあるため、本番環境では使用しないでください。
> テスト目的やローカル開発でのみ使用してください。

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'development',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!, // 非推奨
  stripeAccountName: 'MyCompany (Dev)',
});
```

### 通知メッセージの言語設定

日本語（デフォルト）または英語の通知メッセージを選択できます：

```typescript
// 日本語メッセージ（デフォルト）
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'ja', // または省略可能（デフォルトは 'ja'）
});

// 英語メッセージ
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'en',
});
```

### Lambda関数のカスタマイズ

```typescript
import * as cdk from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import { StripeCheckoutHandler } from 'cdk-stripe-slack-notification';

new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'en',
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
export STRIPE_SECRET_KEY="<your-stripe-live-secret-key>"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic"
export STRIPE_ACCOUNT_NAME="MyCompany"
```

**開発環境:**
```bash
export STRIPE_TEST_SECRET_KEY="<your-stripe-test-secret-key>"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic-dev"
export STRIPE_ACCOUNT_NAME="MyCompany (Test)"
export STRIPE_SANDBOX_ACCOUNT_ID="acct_xxxxxxxxxxxxx"
```

### 4. Stripe Secret Keyの取得

1. [Stripe Dashboard](https://dashboard.stripe.com) にログイン
2. **Developers** > **API keys** を選択
3. **Secret key** をコピー
   - テスト環境: `sk_test_` で始まるキー
   - 本番環境: `sk_live_` で始まるキー

### 5. Stripe Secret Keyの安全な管理

#### ⚠️ セキュリティ上の重要な注意事項

- **Secret Keyは絶対にGitにコミットしないでください**
- **本番環境では必ずSecrets ManagerまたはSSM Parameter Storeを使用してください**
- `.env`ファイルは`.gitignore`に追加してください
- 環境変数への直接設定は開発環境のみに限定してください

#### 方法1: AWS Secrets Managerを使用（推奨）

**メリット:**
- 自動ローテーション機能
- 詳細な監査ログ
- きめ細かいアクセス制御
- クロスリージョンレプリケーション

**セットアップ手順:**

1. AWS CLIでシークレットを作成:

```bash
# 文字列として保存する場合
aws secretsmanager create-secret \
  --name stripe/secret-key \
  --secret-string "<your-stripe-secret-key>" \
  --region us-west-2

# JSONとして保存する場合（複数の値を管理）
aws secretsmanager create-secret \
  --name app/secrets \
  --secret-string '{"STRIPE_SECRET_KEY":"<your-stripe-secret-key>","OTHER_KEY":"value"}' \
  --region us-west-2
```

2. CDKコードで参照:

```typescript
import { StripeCheckoutHandler } from 'cdk-stripe-slack-notification';

// 文字列シークレットの場合
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
});

// JSONシークレットの場合
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:app/secrets-abc123',
    secretKey: 'STRIPE_SECRET_KEY', // JSON内のキー
  },
  stripeAccountName: 'MyCompany',
});
```

**料金:** $0.40/月 + API呼び出し $0.05/10,000回

#### 方法2: SSM Parameter Store (SecureString) を使用

**メリット:**
- 低コスト（無料枠あり）
- シンプルな構成
- KMSによる暗号化

**セットアップ手順:**

1. AWS CLIでパラメータを作成:

```bash
aws ssm put-parameter \
  --name "/stripe/secret-key" \
  --value "<your-stripe-secret-key>" \
  --type SecureString \
  --region us-west-2
```

2. CDKコードで参照:

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSsmParameter: {
    parameterName: '/stripe/secret-key',
  },
  stripeAccountName: 'MyCompany',
});
```

**料金:** 無料（標準パラメータ、10,000個まで）

#### 方法3: 環境変数（開発環境のみ）

**⚠️ 本番環境では使用しないでください**

開発環境やテスト環境でのみ使用してください：

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'development',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeAccountName: 'MyCompany (Dev)',
});
```

### 6. EventBridgeルールの設定

このConstructで作成されたLambda関数をEventBridgeルールのターゲットに設定します：

```typescript
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';

const construct = new StripeCheckoutHandler(stack, 'StripeNotification', {
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

### StripeCheckoutHandlerProps

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `environment` | `string` | ✅ | デプロイ環境 (例: `development`, `production`) |
| `snsTopicArn` | `string` | ✅ | Slack通知を送信するSNS TopicのARN |
| `stripeSecretKey` | `string` | ⚠️ | **非推奨** StripeのSecret Key (本番環境では使用しないでください) |
| `stripeSecretKeyFromSecretsManager` | `StripeSecretFromSecretsManager` | 🔒 | **推奨** AWS Secrets ManagerからStripe Secret Keyを取得する設定 |
| `stripeSecretKeyFromSsmParameter` | `StripeSecretFromSsmParameter` | 🔒 | **推奨** SSM Parameter StoreからStripe Secret Keyを取得する設定 |
| `stripeAccountName` | `string` | ✅ | Stripeアカウント名（通知メッセージに表示） |
| `stripeSandboxAccountId` | `string` | ❌ | StripeサンドボックスアカウントID（テスト環境の場合） |
| `notificationLanguage` | `"ja" \| "en"` | ❌ | 通知メッセージの言語（デフォルト: `"ja"`） |
| `lambdaOptions` | `Partial<NodejsFunctionProps>` | ❌ | Lambda関数の追加設定 |

**注意:** `stripeSecretKey`、`stripeSecretKeyFromSecretsManager`、`stripeSecretKeyFromSsmParameter`のいずれか1つを必ず指定してください。

### StripeSecretFromSecretsManager

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `secretArn` | `string` | ✅ | Secrets ManagerのシークレットARNまたは名前 |
| `secretKey` | `string` | ❌ | シークレット内のJSONキー（JSONシークレットの場合） |

### StripeSecretFromSsmParameter

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `parameterName` | `string` | ✅ | SSM Parameter Storeのパラメータ名 |

## 通知内容

Slackに送信される通知には以下の情報が含まれます：

- Checkout Session ID
- Payment Intent ID
- 注文詳細（商品名、数量、金額など）
- Stripeダッシュボードへのリンク
- イベントタイプ
- 環境情報（テスト/本番）

通知メッセージの言語は`notificationLanguage`プロパティで選択できます：
- `"ja"`（デフォルト）: 日本語メッセージ
- `"en"`: 英語メッセージ

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

## npm公開前のチェックリスト

このライブラリをnpmに公開する前に、以下の項目を更新してください：

### 必須項目

- [ ] **package.json**
  - `"name"`: `"cdk-stripe-slack-notification"` → 実際の組織名/パッケージ名に変更（必要に応じて）
  - `"author"`: `"Your Name"` → 実際の作成者名に変更
  - `"repository.url"`: GitHubリポジトリURLを実際のURLに変更

- [ ] **README.md**
  - インストールコマンドの`cdk-stripe-slack-notification`を確認（必要に応じて変更）
  - すべてのコード例で使用している`cdk-stripe-slack-notification`を確認（必要に応じて変更）
  - GitHubリポジトリURL（`https://github.com/hideokamoto/lambda-stripe-notifications`）を実際のURLに変更

### 公開手順

1. 上記のプレースホルダーをすべて更新
2. ビルドとテストが成功することを確認
   ```bash
   npm run build
   npm test
   ```
3. パッケージの内容を確認
   ```bash
   npm pack --dry-run
   ```
   Lambda関数（`lambda/checkout-session.js`と`lambda/checkout-session.d.ts`）が含まれていることを確認
4. npmに公開
   ```bash
   npm publish --access public
   ```

## ライセンス

MIT

## サポート

問題が発生した場合は、[GitHub Issues](https://github.com/hideokamoto/lambda-stripe-notifications/issues)で報告してください。

## 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。
