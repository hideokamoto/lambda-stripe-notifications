import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_lambda_nodejs, aws_iam } from "aws-cdk-lib";
import { join } from "path";

export interface StripeSecretFromSecretsManager {
  /**
   * Secret ARN or name in Secrets Manager
   */
  readonly secretArn: string;

  /**
   * JSON key in the secret (for JSON secrets)
   * @default - Use the entire secret as a string
   */
  readonly secretKey?: string;
}

export interface StripeSecretFromSsmParameter {
  /**
   * Parameter name in SSM Parameter Store
   */
  readonly parameterName: string;
}

export interface StripeCheckoutHandlerProps {
  /**
   * Deployment environment (e.g., development, production)
   */
  readonly environment: string;

  /**
   * ARN of the SNS Topic for sending Slack notifications
   */
  readonly snsTopicArn: string;

  /**
   * Stripe Secret Key (for production or test environment)
   *
   * @deprecated For security reasons, use stripeSecretKeyFromSecretsManager or
   * stripeSecretKeyFromSsmParameter instead
   */
  readonly stripeSecretKey?: string;

  /**
   * Configuration to retrieve Stripe Secret Key from AWS Secrets Manager
   *
   * Specify only one of stripeSecretKey, stripeSecretKeyFromSecretsManager, or
   * stripeSecretKeyFromSsmParameter
   */
  readonly stripeSecretKeyFromSecretsManager?: StripeSecretFromSecretsManager;

  /**
   * Configuration to retrieve Stripe Secret Key from SSM Parameter Store
   *
   * Specify only one of stripeSecretKey, stripeSecretKeyFromSecretsManager, or
   * stripeSecretKeyFromSsmParameter
   */
  readonly stripeSecretKeyFromSsmParameter?: StripeSecretFromSsmParameter;

  /**
   * Stripe account name (displayed in notification messages)
   */
  readonly stripeAccountName: string;

  /**
   * Stripe sandbox account ID (for test environments)
   * @default - Not set
   */
  readonly stripeSandboxAccountId?: string;

  /**
   * Notification message language
   * @default "en"
   */
  readonly notificationLanguage?: "ja" | "en";

  /**
   * Additional Lambda function settings
   * @default - Use default settings
   */
  readonly lambdaOptions?: Partial<aws_lambda_nodejs.NodejsFunctionProps>;
}

/**
 * Construct for sending Stripe payment notifications to Slack
 *
 * Receives Stripe events via EventBridge and sends notifications to Slack via AWS Chatbot.
 */
export class StripeCheckoutHandler extends Construct {
  /**
   * Created Lambda function
   */
  public readonly lambdaFunction: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: StripeCheckoutHandlerProps) {
    super(scope, id);

    // Validate secret key configuration method
    const secretKeyOptions = [
      props.stripeSecretKey,
      props.stripeSecretKeyFromSecretsManager,
      props.stripeSecretKeyFromSsmParameter,
    ].filter(Boolean);

    if (secretKeyOptions.length === 0) {
      throw new Error(
        "Please specify one of stripeSecretKey, stripeSecretKeyFromSecretsManager, or " +
          "stripeSecretKeyFromSsmParameter",
      );
    }

    if (secretKeyOptions.length > 1) {
      throw new Error(
        "Cannot specify stripeSecretKey, stripeSecretKeyFromSecretsManager, and " +
          "stripeSecretKeyFromSsmParameter at the same time. Please choose one.",
      );
    }

    // Set environment variables
    const environment: { [key: string]: string } = {
      APP_ENV: props.environment,
      SNS_TOPIC_ARN: props.snsTopicArn,
      STRIPE_ACCOUNT_NAME: props.stripeAccountName,
      STRIPE_SANDBOX_ACCOUNT_ID: props.stripeSandboxAccountId || "",
      NOTIFICATION_LANGUAGE: props.notificationLanguage || "en",
    };

    // Set secret key retrieval method
    if (props.stripeSecretKey) {
      environment.STRIPE_SECRET_KEY = props.stripeSecretKey;
      environment.STRIPE_SECRET_SOURCE = "env";
    } else if (props.stripeSecretKeyFromSecretsManager) {
      environment.STRIPE_SECRET_SOURCE = "secretsmanager";
      environment.STRIPE_SECRET_ARN = props.stripeSecretKeyFromSecretsManager.secretArn;
      if (props.stripeSecretKeyFromSecretsManager.secretKey) {
        environment.STRIPE_SECRET_JSON_KEY = props.stripeSecretKeyFromSecretsManager.secretKey;
      }
    } else if (props.stripeSecretKeyFromSsmParameter) {
      environment.STRIPE_SECRET_SOURCE = "ssm";
      environment.STRIPE_SECRET_PARAMETER_NAME =
        props.stripeSecretKeyFromSsmParameter.parameterName;
    }

    this.lambdaFunction = new aws_lambda_nodejs.NodejsFunction(this, "Handler", {
      // Default values that can be overridden by users
      timeout: cdk.Duration.seconds(30),
      ...props.lambdaOptions,
      // Required properties fixed by the Construct
      entry: join(__dirname, "../lambda/checkout-session.ts"),
      handler: "handler",
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        // Allow users to add additional environment variables
        ...props.lambdaOptions?.environment,
        // Required environment variables set by the Construct (cannot be overridden)
        ...environment,
      },
    });

    // Add SNS permissions
    this.lambdaFunction.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: [props.snsTopicArn],
      }),
    );

    // Add Secrets Manager permissions
    if (props.stripeSecretKeyFromSecretsManager) {
      this.lambdaFunction.addToRolePolicy(
        new aws_iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [props.stripeSecretKeyFromSecretsManager.secretArn],
        }),
      );
    }

    // Add SSM Parameter Store permissions
    if (props.stripeSecretKeyFromSsmParameter) {
      // Build ARN from parameter name
      const stack = cdk.Stack.of(this);
      const parameterArn = `arn:aws:ssm:${stack.region}:${stack.account}:parameter/${props.stripeSecretKeyFromSsmParameter.parameterName.replace(/^\//, "")}`;

      this.lambdaFunction.addToRolePolicy(
        new aws_iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [parameterArn],
        }),
      );
    }
  }
}

/**
 * @deprecated Please use StripeCheckoutHandler instead
 */
export class StripeNotificationsStack extends cdk.Stack {
  public readonly notificationConstruct: StripeCheckoutHandler;

  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps & {
      environment: string;
    },
  ) {
    super(scope, id, props);

    this.notificationConstruct = new StripeCheckoutHandler(this, "StripeNotification", {
      environment: props?.environment || "dev",
      snsTopicArn: process.env.SLACK_NOTIFICATION_SNS_ARN as string,
      stripeSecretKey: (props?.environment === "production"
        ? process.env.STRIPE_LIVE_SECRET_KEY
        : process.env.STRIPE_TEST_SECRET_KEY) as string,
      stripeAccountName: process.env.STRIPE_ACCOUNT_NAME as string,
      stripeSandboxAccountId: process.env.STRIPE_SANDBOX_ACCOUNT_ID,
    });
  }
}
