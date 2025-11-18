# Stripe Notification Construct for AWS CDK

An AWS CDK Construct library for sending Stripe payment notifications to Slack. It receives Stripe EventBridge events and sends notifications to Slack via AWS Chatbot.

## Features

- Automatic Slack notifications when Stripe payments are completed
- Integration with AWS EventBridge
- Support for switching between test and production environments
- Support for Japanese and English notification messages
- Full TypeScript support
- Customizable Lambda configuration

## Supported Events

- `checkout.session.completed` - When checkout session is completed
- `checkout.session.async_payment_succeeded` - When async payment succeeds

## Installation

```bash
npm install cdk-stripe-slack-notification
```

or

```bash
yarn add cdk-stripe-slack-notification
```

## Usage

### 🔒 Recommended: Using AWS Secrets Manager

For security best practices, we recommend using Secrets Manager:

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
  notificationLanguage: 'en', // or 'ja' for Japanese messages
});
```

To retrieve a specific key from a JSON secret:

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:app-secrets-abc123',
    secretKey: 'STRIPE_SECRET_KEY', // Key name in JSON
  },
  stripeAccountName: 'MyCompany',
});
```

### 🔒 Recommended: Using SSM Parameter Store

For cost efficiency, you can use SSM Parameter Store (SecureString):

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

### ⚠️ Not Recommended: Direct Environment Variable Method

> **Warning**: Do not use in production environments due to security risks.
> Use only for testing purposes or local development.

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'development',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!, // Not recommended
  stripeAccountName: 'MyCompany (Dev)',
});
```

### Notification Message Language Settings

You can choose between English (default) or Japanese notification messages:

```typescript
// English messages (default)
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'en', // or omit (default is 'en')
});

// Japanese messages
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
  notificationLanguage: 'ja',
});
```

### Lambda Function Customization

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

## Setup Instructions

### 1. Stripe EventBridge Configuration

Configure EventBridge integration in the Stripe Dashboard:

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Select **Developers** > **Webhooks** > **Add destination**
3. Select **Amazon EventBridge**
4. Enter your AWS Account ID and region
5. Select events to send:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`

### 2. AWS Chatbot Configuration

Configure AWS Chatbot to receive notifications in Slack:

1. Open [AWS Chatbot Console](https://console.aws.amazon.com/chatbot/)
2. Connect your Slack workspace via **Configure new client**
3. Configure a Slack channel via **Configure new channel**
4. Create an SNS Topic and associate it with the Chatbot channel
5. Note the ARN of the created SNS Topic (used in this Construct)

### 3. Environment Variable Configuration

Set the following environment variables:

**Production Environment:**
```bash
export STRIPE_SECRET_KEY="<your-stripe-live-secret-key>"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic"
export STRIPE_ACCOUNT_NAME="MyCompany"
```

**Development Environment:**
```bash
export STRIPE_TEST_SECRET_KEY="<your-stripe-test-secret-key>"
export SNS_TOPIC_ARN="arn:aws:sns:us-west-2:123456789:your-slack-topic-dev"
export STRIPE_ACCOUNT_NAME="MyCompany (Test)"
export STRIPE_SANDBOX_ACCOUNT_ID="acct_xxxxxxxxxxxxx"
```

### 4. Obtaining Stripe Secret Key

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Select **Developers** > **API keys**
3. Copy the **Secret key**
   - Test environment: Key starting with `sk_test_`
   - Production environment: Key starting with `sk_live_`

### 5. Secure Management of Stripe Secret Key

#### ⚠️ Important Security Notes

- **Never commit Secret Keys to Git**
- **Always use Secrets Manager or SSM Parameter Store in production environments**
- Add `.env` files to `.gitignore`
- Limit direct environment variable settings to development environments only

#### Method 1: Using AWS Secrets Manager (Recommended)

**Benefits:**
- Automatic rotation functionality
- Detailed audit logs
- Fine-grained access control
- Cross-region replication

**Setup Steps:**

1. Create a secret using AWS CLI:

```bash
# To save as a string
aws secretsmanager create-secret \
  --name stripe/secret-key \
  --secret-string "<your-stripe-secret-key>" \
  --region us-west-2

# To save as JSON (for managing multiple values)
aws secretsmanager create-secret \
  --name app/secrets \
  --secret-string '{"STRIPE_SECRET_KEY":"<your-stripe-secret-key>","OTHER_KEY":"value"}' \
  --region us-west-2
```

2. Reference in CDK code:

```typescript
import { StripeCheckoutHandler } from 'cdk-stripe-slack-notification';

// For string secrets
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:stripe/secret-key-abc123',
  },
  stripeAccountName: 'MyCompany',
});

// For JSON secrets
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'production',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKeyFromSecretsManager: {
    secretArn: 'arn:aws:secretsmanager:us-west-2:123456789:secret:app/secrets-abc123',
    secretKey: 'STRIPE_SECRET_KEY', // Key in JSON
  },
  stripeAccountName: 'MyCompany',
});
```

**Pricing:** $0.40/month + $0.05 per 10,000 API calls

#### Method 2: Using SSM Parameter Store (SecureString)

**Benefits:**
- Low cost (free tier available)
- Simple configuration
- KMS encryption

**Setup Steps:**

1. Create a parameter using AWS CLI:

```bash
aws ssm put-parameter \
  --name "/stripe/secret-key" \
  --value "<your-stripe-secret-key>" \
  --type SecureString \
  --region us-west-2
```

2. Reference in CDK code:

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

**Pricing:** Free (standard parameters, up to 10,000)

#### Method 3: Environment Variables (Development Only)

**⚠️ Do not use in production environments**

Use only in development or test environments:

```typescript
new StripeCheckoutHandler(stack, 'StripeNotification', {
  environment: 'development',
  snsTopicArn: 'arn:aws:sns:us-west-2:123456789:my-slack-topic',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeAccountName: 'MyCompany (Dev)',
});
```

### 6. EventBridge Rule Configuration

Configure the Lambda function created by this Construct as a target for EventBridge rules:

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

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `environment` | `string` | ✅ | Deployment environment (e.g., `development`, `production`) |
| `snsTopicArn` | `string` | ✅ | ARN of the SNS Topic for sending Slack notifications |
| `stripeSecretKey` | `string` | ⚠️ | **Not recommended** Stripe Secret Key (do not use in production) |
| `stripeSecretKeyFromSecretsManager` | `StripeSecretFromSecretsManager` | 🔒 | **Recommended** Configuration to retrieve Stripe Secret Key from AWS Secrets Manager |
| `stripeSecretKeyFromSsmParameter` | `StripeSecretFromSsmParameter` | 🔒 | **Recommended** Configuration to retrieve Stripe Secret Key from SSM Parameter Store |
| `stripeAccountName` | `string` | ✅ | Stripe account name (displayed in notification messages) |
| `stripeSandboxAccountId` | `string` | ❌ | Stripe sandbox account ID (for test environments) |
| `notificationLanguage` | `"ja" \| "en"` | ❌ | Notification message language (default: `"en"`) |
| `lambdaOptions` | `Partial<NodejsFunctionProps>` | ❌ | Additional Lambda function settings |

**Note:** You must specify exactly one of `stripeSecretKey`, `stripeSecretKeyFromSecretsManager`, or `stripeSecretKeyFromSsmParameter`.

### StripeSecretFromSecretsManager

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `secretArn` | `string` | ✅ | Secret ARN or name in Secrets Manager |
| `secretKey` | `string` | ❌ | JSON key in the secret (for JSON secrets) |

### StripeSecretFromSsmParameter

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `parameterName` | `string` | ✅ | Parameter name in SSM Parameter Store |

## Notification Content

Notifications sent to Slack include the following information:

- Checkout Session ID
- Payment Intent ID
- Order details (product name, quantity, amount, etc.)
- Link to Stripe Dashboard
- Event type
- Environment information (test/production)

The notification message language can be selected using the `notificationLanguage` property:
- `"en"` (default): English messages
- `"ja"`: Japanese messages

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Local Development

```bash
npm run watch
```

## Sample Code

See the [examples](./examples) directory for detailed sample code.

## Pre-publish Checklist for npm

Before publishing this library to npm, update the following items:

### Required Items

- [ ] **package.json**
  - `"name"`: `"cdk-stripe-slack-notification"` → Change to actual organization/package name (if needed)
  - `"author"`: `"Your Name"` → Change to actual author name
  - `"repository.url"`: Change GitHub repository URL to actual URL

- [ ] **README.md**
  - Verify installation command `cdk-stripe-slack-notification` (change if needed)
  - Verify all code examples use `cdk-stripe-slack-notification` (change if needed)
  - Change GitHub repository URL (`https://github.com/hideokamoto/lambda-stripe-notifications`) to actual URL

### Publishing Steps

1. Update all placeholders above
2. Verify that build and tests succeed
   ```bash
   npm run build
   npm test
   ```
3. Verify package contents
   ```bash
   npm pack --dry-run
   ```
   Verify that Lambda functions (`lambda/checkout-session.js` and `lambda/checkout-session.d.ts`) are included
4. Publish to npm
   ```bash
   npm publish --access public
   ```

## Choosing Between Constructs

This library (`lambda-stripe-notifications`) and `aws-simple-stripe-event-notifier` are both designed to handle Stripe events, but they serve different use cases:

### When to Use `lambda-stripe-notifications`

- **Stripe API integration**: You need to fetch additional details from Stripe API (e.g., retrieving full checkout session details, customer information)
- **Slack notifications**: You specifically need formatted Slack notifications via AWS Chatbot with rich message formatting
- **Complex processing**: You need to perform custom business logic, data transformation, or validation
- **Checkout events**: You're primarily handling `checkout.session.completed` and `checkout.session.async_payment_succeeded` events
- **Multi-language support**: You need built-in support for Japanese and English notification messages
- **Stripe secret key management**: You need secure handling of Stripe API keys via Secrets Manager or SSM Parameter Store

### When to Use `aws-simple-stripe-event-notifier`

- **Simple event forwarding**: You need to forward Stripe events to SNS without additional processing
- **No Lambda overhead**: You want to avoid Lambda execution costs and cold starts
- **Custom message formatting**: You need full control over the SNS message format using EventBridge's message templating
- **All event types**: You need to handle any Stripe event type with flexible filtering
- **Direct integration**: You prefer EventBridge → SNS direct integration without intermediate processing
- **Cost optimization**: You want to minimize AWS costs by avoiding Lambda execution

### Comparison Summary

| Feature | `lambda-stripe-notifications` | `aws-simple-stripe-event-notifier` |
|---------|-------------------------------|-----------------------------------|
| Architecture | EventBridge → Lambda → SNS | EventBridge → SNS |
| Lambda Required | ✅ Yes | ❌ No |
| Stripe API Calls | ✅ Yes | ❌ No |
| Message Customization | ⚠️ Limited to predefined format | ✅ Full control via templates |
| Event Types | ⚠️ Checkout events focused | ✅ All Stripe events |
| Cost | 💰 Higher (Lambda execution) | 💰 Lower (no Lambda) |
| Latency | ⚡ Higher (Lambda processing) | ⚡ Lower (direct) |
| Use Case | Specialized Slack notifications | Generic event forwarding |

## License

MIT

## Support

If you encounter any issues, please report them on [GitHub Issues](https://github.com/hideokamoto/lambda-stripe-notifications/issues).

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
