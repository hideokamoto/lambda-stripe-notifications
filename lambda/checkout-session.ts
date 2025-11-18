import type { EventBridgeHandler } from "aws-lambda";
import Stripe from "stripe";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

// Initialize AWS SDK clients at module scope (reused across Lambda invocations)
const region = process.env.AWS_REGION || "us-east-1";
const secretsManagerClient = new SecretsManagerClient({ region });
const ssmClient = new SSMClient({ region });
const snsClient = new SNSClient({ region });

type EventDetailType = "checkout.session.async_payment_succeeded" | "checkout.session.completed";
type EventDetail =
  | Stripe.CheckoutSessionAsyncPaymentSucceededEvent
  | Stripe.CheckoutSessionCompletedEvent;

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

type NotificationLanguage = "ja" | "en";

interface NotificationMessages {
  title: string;
  accountMessage: string;
  orderDetail: string;
  dashboardLink: string;
  eventType: string;
  sandboxId: string;
  liveAccount: string;
}

/**
 * Retrieves Stripe Secret Key based on environment variable configuration
 * @returns Stripe Secret Key
 */
async function getStripeSecretKey(): Promise<string> {
  const secretSource = process.env.STRIPE_SECRET_SOURCE;

  if (!secretSource) {
    throw new Error("STRIPE_SECRET_SOURCE environment variable is not set");
  }

  // Retrieve directly from environment variable (not recommended)
  if (secretSource === "env") {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    return secretKey;
  }

  // Retrieve from Secrets Manager
  if (secretSource === "secretsmanager") {
    const secretArn = process.env.STRIPE_SECRET_ARN;
    if (!secretArn) {
      throw new Error("STRIPE_SECRET_ARN environment variable is not set");
    }

    try {
      const response = await secretsManagerClient.send(
        new GetSecretValueCommand({
          SecretId: secretArn,
        }),
      );

      if (!response.SecretString) {
        throw new Error("Secret value is empty");
      }

      // If JSON key is specified, retrieve the value for that key
      const secretKey = process.env.STRIPE_SECRET_JSON_KEY;
      if (secretKey) {
        const secretObject = JSON.parse(response.SecretString);
        if (!secretObject[secretKey]) {
          throw new Error(`Secret key "${secretKey}" not found in secret`);
        }
        return secretObject[secretKey];
      }

      // If JSON key is not specified, return the entire secret
      return response.SecretString;
    } catch (error) {
      console.error("Failed to retrieve secret from Secrets Manager:", error);
      throw new Error(
        `Secrets Manager error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  // Retrieve from SSM Parameter Store
  if (secretSource === "ssm") {
    const parameterName = process.env.STRIPE_SECRET_PARAMETER_NAME;
    if (!parameterName) {
      throw new Error("STRIPE_SECRET_PARAMETER_NAME environment variable is not set");
    }

    try {
      const response = await ssmClient.send(
        new GetParameterCommand({
          Name: parameterName,
          WithDecryption: true,
        }),
      );

      if (!response.Parameter?.Value) {
        throw new Error("Parameter value is empty");
      }

      return response.Parameter.Value;
    } catch (error) {
      console.error("Failed to retrieve parameter from SSM:", error);
      throw new Error(`SSM error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  throw new Error(`Invalid STRIPE_SECRET_SOURCE: ${secretSource}`);
}

/**
 * Gets notification messages based on language
 */
function getNotificationMessages(language: NotificationLanguage): NotificationMessages {
  if (language === "ja") {
    return {
      title: "新しい決済が発生しました",
      accountMessage: "アカウントにて決済が発生しました。",
      orderDetail: "*Order detail*",
      dashboardLink: "で注文を確認する",
      eventType: "EventType:",
      sandboxId: "Sandbox ID:",
      liveAccount: "Live account",
    };
  }

  // Default is English
  return {
    title: "New payment received",
    accountMessage: "account",
    orderDetail: "*Order detail*",
    dashboardLink: "View order in Dashboard",
    eventType: "EventType:",
    sandboxId: "Sandbox ID:",
    liveAccount: "Live account",
  };
}

const targetEventDetailTypes = [
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
];

export const handler: EventBridgeHandler<EventDetailType, EventDetail, void> = async (event) => {
  try {
    // Validate event type
    if (!targetEventDetailTypes.includes(event["detail-type"])) {
      console.log(`Skipping unsupported event type: ${event["detail-type"]}`);
      return;
    }

    // Validate environment variables
    const requiredEnvVars = ["STRIPE_SECRET_SOURCE", "SNS_TOPIC_ARN", "STRIPE_ACCOUNT_NAME"];
    const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
    if (missingEnvVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
    }

    // Retrieve Stripe Secret Key
    const stripeSecretKey = await getStripeSecretKey();

    const isDevMode = process.env.APP_ENV !== "production";
    const notificationLanguage = (process.env.NOTIFICATION_LANGUAGE || "en") as NotificationLanguage;
    const messages = getNotificationMessages(notificationLanguage);
    const stripe = new Stripe(stripeSecretKey);
    const checkoutSession = event.detail.data.object;

    const { id, payment_status: paymentStatus } = checkoutSession;

    // Skip if unpaid
    if (paymentStatus === "unpaid") {
      console.log(`Skipping unpaid checkout session: ${id}`);
      return;
    }

    // Retrieve detailed information from Stripe API
    let lineItems;
    try {
      const response = await stripe.checkout.sessions.listLineItems(id, {
        expand: ["data.price.product"],
      });
      lineItems = response.data;
    } catch (error) {
      console.error(`Failed to fetch line items for session ${id}:`, error);
      throw new Error(
        `Stripe API error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    const paymentIntentId =
      typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id;

    const dashboardUrl = [
      "https://dashboard.stripe.com",
      process.env.APP_ENV !== "production" ? "test" : null,
      "payments",
      paymentIntentId,
    ]
      .filter(Boolean)
      .join("/");

    // Create Slack notification message
    const slackNotificationMessage: AWSChatbotCustomMessage = {
      version: "1.0",
      source: "custom",
      content: {
        textType: "client-markdown",
        title: `${isDevMode ? "[Test] " : ""}${messages.title}`,
        description: [
          notificationLanguage === "en"
            ? `A payment has been received on the ${process.env.STRIPE_ACCOUNT_NAME} ${messages.accountMessage}.`
            : `${process.env.STRIPE_ACCOUNT_NAME}${messages.accountMessage}`,
          `- *Checkout Session ID*: ${checkoutSession.id}`,
          `- *Payment Intent ID*: ${paymentIntentId}`,
          "",
          messages.orderDetail,
          lineItems
            .map((item) => {
              const product = item.price?.product;
              const productName =
                product && typeof product !== "string" && !product.deleted
                  ? product.name
                  : notificationLanguage === "ja" ? "不明な商品" : "Unknown Product";
              return [
                `- Amount total: ${item.amount_total}`,
                `- Amount subtotal: ${item.amount_subtotal}`,
                `- Description: ${item.description}`,
                `- Product name: ${productName}`,
                `- Quantity: ${item.quantity}`,
              ].join("\n");
            })
            .join("\n"),
        ].join("\n"),
        nextSteps: [`<${dashboardUrl}|Dashboard>${messages.dashboardLink}`],
        keywords: [
          `${messages.eventType} ${event["detail-type"]}`,
          isDevMode
            ? `${messages.sandboxId} ${process.env.STRIPE_SANDBOX_ACCOUNT_ID}`
            : messages.liveAccount,
        ],
      },
    };

    // Send notification to Slack via SNS
    const snsTopicArn = process.env.SNS_TOPIC_ARN as string;

    try {
      await snsClient.send(
        new PublishCommand({
          Message: JSON.stringify(slackNotificationMessage, null, 2),
          TopicArn: snsTopicArn,
        }),
      );
      console.log(`Successfully sent notification for checkout session: ${id}`);
    } catch (error) {
      console.error("Failed to publish to SNS:", error);
      throw new Error(
        `SNS publish error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  } catch (error) {
    console.error("Error processing Stripe event:", error);
    // Re-throw error to fail Lambda execution (EventBridge will retry)
    throw error;
  }
};
