import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { aws_lambda_nodejs, aws_iam } from "aws-cdk-lib";
import { join } from "path";

export interface StripeSecretFromSecretsManager {
  /**
   * Secrets ManagerのシークレットARNまたは名前
   */
  readonly secretArn: string;

  /**
   * シークレット内のJSONキー（JSONシークレットの場合）
   * @default - シークレット全体を文字列として使用
   */
  readonly secretKey?: string;
}

export interface StripeSecretFromSsmParameter {
  /**
   * SSM Parameter Storeのパラメータ名
   */
  readonly parameterName: string;
}

export interface StripeCheckoutHandlerProps {
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
   *
   * @deprecated セキュリティ上の理由から、stripeSecretKeyFromSecretsManagerまたは
   * stripeSecretKeyFromSsmParameterの使用を推奨します
   */
  readonly stripeSecretKey?: string;

  /**
   * AWS Secrets ManagerからStripe Secret Keyを取得する設定
   *
   * stripeSecretKey、stripeSecretKeyFromSecretsManager、stripeSecretKeyFromSsmParameterの
   * いずれか1つのみを指定してください
   */
  readonly stripeSecretKeyFromSecretsManager?: StripeSecretFromSecretsManager;

  /**
   * SSM Parameter StoreからStripe Secret Keyを取得する設定
   *
   * stripeSecretKey、stripeSecretKeyFromSecretsManager、stripeSecretKeyFromSsmParameterの
   * いずれか1つのみを指定してください
   */
  readonly stripeSecretKeyFromSsmParameter?: StripeSecretFromSsmParameter;

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
export class StripeCheckoutHandler extends Construct {
  /**
   * 作成されたLambda関数
   */
  public readonly lambdaFunction: aws_lambda_nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: StripeCheckoutHandlerProps) {
    super(scope, id);

    // シークレットキーの設定方法を検証
    const secretKeyOptions = [
      props.stripeSecretKey,
      props.stripeSecretKeyFromSecretsManager,
      props.stripeSecretKeyFromSsmParameter,
    ].filter(Boolean);

    if (secretKeyOptions.length === 0) {
      throw new Error(
        "stripeSecretKey、stripeSecretKeyFromSecretsManager、または" +
          "stripeSecretKeyFromSsmParameterのいずれか1つを指定してください",
      );
    }

    if (secretKeyOptions.length > 1) {
      throw new Error(
        "stripeSecretKey、stripeSecretKeyFromSecretsManager、" +
          "stripeSecretKeyFromSsmParameterは同時に指定できません。いずれか1つを選択してください",
      );
    }

    // 環境変数の設定
    const environment: { [key: string]: string } = {
      APP_ENV: props.environment,
      SNS_TOPIC_ARN: props.snsTopicArn,
      STRIPE_ACCOUNT_NAME: props.stripeAccountName,
      STRIPE_SANDBOX_ACCOUNT_ID: props.stripeSandboxAccountId || "",
    };

    // シークレットキーの取得方法を設定
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
      // 利用者による上書きを許可するデフォルト値
      timeout: cdk.Duration.seconds(30),
      ...props.lambdaOptions,
      // Constructが固定する必須プロパティ
      entry: join(__dirname, "../lambda/checkout-session.ts"),
      handler: "handler",
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      environment: {
        // 利用者による環境変数の追加を許可
        ...props.lambdaOptions?.environment,
        // Constructが設定する必須の環境変数（上書き不可）
        ...environment,
      },
    });

    // SNS権限を追加
    this.lambdaFunction.addToRolePolicy(
      new aws_iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: [props.snsTopicArn],
      }),
    );

    // Secrets Manager権限を追加
    if (props.stripeSecretKeyFromSecretsManager) {
      this.lambdaFunction.addToRolePolicy(
        new aws_iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [props.stripeSecretKeyFromSecretsManager.secretArn],
        }),
      );
    }

    // SSM Parameter Store権限を追加
    if (props.stripeSecretKeyFromSsmParameter) {
      // パラメータ名からARNを構築
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
 * @deprecated StripeCheckoutHandlerを使用してください
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
