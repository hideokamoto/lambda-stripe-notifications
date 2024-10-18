import { EventBridgeHandler } from 'aws-lambda';
import Stripe from 'stripe'
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

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

const targetEventDetailTypes = ['checkout.session.async_payment_succeeded' , 'checkout.session.completed']
export const handler: EventBridgeHandler<EventDetailType, EventDetail, void> = async (event) => {
    if (!targetEventDetailTypes.includes(event['detail-type'])) {
        return
    }
    const isDevMode = process.env.APP_ENV !== 'production'
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
    const checkoutSession = event.detail.data.object
    const {
        id,
        payment_status: paymentStatus,
    } = checkoutSession
    if (paymentStatus === 'unpaid') {
        return;
    }
    const { data: lineItems} = await stripe.checkout.sessions.listLineItems(id, {
        expand: ['data.price.product']
    })
    const paymentIntentId = typeof checkoutSession.payment_intent === 'string' ? checkoutSession.payment_intent : checkoutSession.payment_intent?.id
    const dashboardUrl = [
        'https://dashboard.stripe.com',
        process.env.APP_ENV !== 'production' ? 'test' : null,
        'payments',
        paymentIntentId
    ].filter(Boolean).join('/')
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
                    const product = item.price?.product as Stripe.Product
                    return [
                        `- Amount total: ${item.amount_total}`,
                        `- Amount subtotal: ${item.amount_subtotal}`,
                        `- Description: ${item.description}`,
                        `- Product name: ${product.name}`,
                        `- Quantity: ${item.quantity}`
                    ].join('\n')
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
    }
    const snsTopicArn = process.env.SNS_TOPIC_ARN as string
    const region = getRegionFromArn(snsTopicArn) as string
    const snsClient = new SNSClient({ region });
    await snsClient.send(
      new PublishCommand({
        Message: JSON.stringify(slackNotificationMessage, null, 2),
        TopicArn: snsTopicArn,
      }),
    );
}