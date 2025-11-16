import { EventBridgeHandler } from 'aws-lambda';
import Stripe from 'stripe'
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

type EventDetailType = 'checkout.session.async_payment_succeeded' | 'checkout.session.completed';
type EventDetail = Stripe.CheckoutSessionAsyncPaymentSucceededEvent | Stripe.CheckoutSessionCompletedEvent;

type AWSChatbotCustomMessage = {
    version: "1.0";
    source: "custom";
    id?: string;
    content: {
      textType?: "client-markdown";
      title?: string;
      description: string;
      nextSteps?: string[];
      keywords?: string[];
    };
    metadata?: {
      threadId?: string;
      summary?: string;
      eventType?: string;
      relatedResources?: string[];
      additionalContext?: {
        [key: string]: string;
      };
    };
  };

/**
 * AWS ARNからリージョンを抽出する関数
 * @param arn AWS リソースのARN
 * @returns リージョン文字列、ARNが無効な場合はnull
 */
function getRegionFromArn(arn: string): string | null {
    const arnParts = arn.split(':');

    if (arnParts.length < 6) {
      console.error('Invalid ARN format');
      return null;
    }

    const region = arnParts[3];

    if (region === '') {
      console.error('Region not found in ARN');
      return null;
    }

    return region;
  }

/**
 * 環境変数の設定に応じてStripe Secret Keyを取得する
 * @returns Stripe Secret Key
 */
async function getStripeSecretKey(): Promise<string> {
    const secretSource = process.env.STRIPE_SECRET_SOURCE;

    if (!secretSource) {
        throw new Error('STRIPE_SECRET_SOURCE environment variable is not set');
    }

    // 環境変数から直接取得（非推奨）
    if (secretSource === 'env') {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY environment variable is not set');
        }
        return secretKey;
    }

    // Secrets Managerから取得
    if (secretSource === 'secretsmanager') {
        const secretArn = process.env.STRIPE_SECRET_ARN;
        if (!secretArn) {
            throw new Error('STRIPE_SECRET_ARN environment variable is not set');
        }

        const region = getRegionFromArn(secretArn) || process.env.AWS_REGION || 'us-east-1';
        const client = new SecretsManagerClient({ region });

        try {
            const response = await client.send(
                new GetSecretValueCommand({
                    SecretId: secretArn,
                })
            );

            if (!response.SecretString) {
                throw new Error('Secret value is empty');
            }

            // JSONキーが指定されている場合は、そのキーの値を取得
            const secretKey = process.env.STRIPE_SECRET_JSON_KEY;
            if (secretKey) {
                const secretObject = JSON.parse(response.SecretString);
                if (!secretObject[secretKey]) {
                    throw new Error(`Secret key "${secretKey}" not found in secret`);
                }
                return secretObject[secretKey];
            }

            // JSONキーが指定されていない場合は、シークレット全体を返す
            return response.SecretString;
        } catch (error) {
            console.error('Failed to retrieve secret from Secrets Manager:', error);
            throw new Error(`Secrets Manager error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // SSM Parameter Storeから取得
    if (secretSource === 'ssm') {
        const parameterName = process.env.STRIPE_SECRET_PARAMETER_NAME;
        if (!parameterName) {
            throw new Error('STRIPE_SECRET_PARAMETER_NAME environment variable is not set');
        }

        const region = process.env.AWS_REGION || 'us-east-1';
        const client = new SSMClient({ region });

        try {
            const response = await client.send(
                new GetParameterCommand({
                    Name: parameterName,
                    WithDecryption: true,
                })
            );

            if (!response.Parameter?.Value) {
                throw new Error('Parameter value is empty');
            }

            return response.Parameter.Value;
        } catch (error) {
            console.error('Failed to retrieve parameter from SSM:', error);
            throw new Error(`SSM error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    throw new Error(`Invalid STRIPE_SECRET_SOURCE: ${secretSource}`);
}

const targetEventDetailTypes = ['checkout.session.async_payment_succeeded' , 'checkout.session.completed']

export const handler: EventBridgeHandler<EventDetailType, EventDetail, void> = async (event) => {
    try {
        // イベントタイプのバリデーション
        if (!targetEventDetailTypes.includes(event['detail-type'])) {
            console.log(`Skipping unsupported event type: ${event['detail-type']}`);
            return;
        }

        // 環境変数の検証
        const requiredEnvVars = ['STRIPE_SECRET_SOURCE', 'SNS_TOPIC_ARN', 'STRIPE_ACCOUNT_NAME'];
        const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
        if (missingEnvVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
        }

        // Stripe Secret Keyを取得
        const stripeSecretKey = await getStripeSecretKey();

        const isDevMode = process.env.APP_ENV !== 'production';
        const stripe = new Stripe(stripeSecretKey);
        const checkoutSession = event.detail.data.object;

        const {
            id,
            payment_status: paymentStatus,
        } = checkoutSession;

        // 未払いの場合はスキップ
        if (paymentStatus === 'unpaid') {
            console.log(`Skipping unpaid checkout session: ${id}`);
            return;
        }

        // Stripe APIから詳細情報を取得
        let lineItems;
        try {
            const response = await stripe.checkout.sessions.listLineItems(id, {
                expand: ['data.price.product']
            });
            lineItems = response.data;
        } catch (error) {
            console.error(`Failed to fetch line items for session ${id}:`, error);
            throw new Error(`Stripe API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        const paymentIntentId = typeof checkoutSession.payment_intent === 'string'
            ? checkoutSession.payment_intent
            : checkoutSession.payment_intent?.id;

        const dashboardUrl = [
            'https://dashboard.stripe.com',
            process.env.APP_ENV !== 'production' ? 'test' : null,
            'payments',
            paymentIntentId
        ].filter(Boolean).join('/');

        // Slack通知メッセージの作成
        const slackNotificationMessage: AWSChatbotCustomMessage = {
            version: '1.0',
            source: 'custom',
            content: {
                textType: 'client-markdown',
                title: `${isDevMode ? '[Test] ': ''}新しい決済が発生しました`,
                description: [
                    `${process.env.STRIPE_ACCOUNT_NAME}アカウントにて決済が発生しました。`,
                    `- *Checkout Session ID*: ${checkoutSession.id}`,
                    `- *Payment Intent ID*: ${paymentIntentId}`,
                    '',
                    '*Order detail*',
                    lineItems.map(item => {
                        const product = item.price?.product as Stripe.Product;
                        return [
                            `- Amount total: ${item.amount_total}`,
                            `- Amount subtotal: ${item.amount_subtotal}`,
                            `- Description: ${item.description}`,
                            `- Product name: ${product.name}`,
                            `- Quantity: ${item.quantity}`
                        ].join('\n');
                    }).join('\n')
                ].join('\n'),
                nextSteps: [
                    `<${dashboardUrl}|Dashboard>で注文を確認する`,
                ],
                keywords: [
                    `EventType: ${event['detail-type']}`,
                    isDevMode ? `Sandbox ID: ${process.env.STRIPE_SANDBOX_ACCOUNT_ID}` : 'Live account'
                ]
            }
        };

        // SNS経由でSlackに通知
        const snsTopicArn = process.env.SNS_TOPIC_ARN as string;
        const region = getRegionFromArn(snsTopicArn);

        if (!region) {
            throw new Error(`Invalid SNS Topic ARN: ${snsTopicArn}`);
        }

        const snsClient = new SNSClient({ region });

        try {
            await snsClient.send(
                new PublishCommand({
                    Message: JSON.stringify(slackNotificationMessage, null, 2),
                    TopicArn: snsTopicArn,
                }),
            );
            console.log(`Successfully sent notification for checkout session: ${id}`);
        } catch (error) {
            console.error('Failed to publish to SNS:', error);
            throw new Error(`SNS publish error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error processing Stripe event:', error);
        // エラーを再スローしてLambdaの実行を失敗させる（EventBridgeがリトライする）
        throw error;
    }
}