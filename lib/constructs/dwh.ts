import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  aws_athena as athena,
  aws_glue as glue,
  aws_s3 as s3,
  aws_s3_deployment as s3_deployment,
} from "aws-cdk-lib";

type DwhConstructProps = {};

export class DwhConstruct extends Construct {
  readonly athenaWgName: string;
  readonly dbName: string;
  readonly tableName: string;

  constructor(scope: Construct, id: string, props: DwhConstructProps) {
    super(scope, id);

    const athenaResultBucket = new s3.Bucket(this, "AthenaResultBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    this.athenaWgName = "line-wg";

    const athenaWg = new athena.CfnWorkGroup(this, "AthenaWg", {
      name: this.athenaWgName,
      workGroupConfiguration: {
        resultConfiguration: {
          outputLocation: `s3://${athenaResultBucket.bucketName}/athena-results/`,
          encryptionConfiguration: {
            encryptionOption: "SSE_S3",
          },
        },
      },
      state: "ENABLED",
      recursiveDeleteOption: true,
    });

    const lineDBBucket = new s3.Bucket(this, "LineDBBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    this.dbName = "line-db";
    this.tableName = "line_users";

    new glue.CfnDatabase(this, "GlueDB", {
      catalogId: cdk.Stack.of(this).account,
      databaseInput: {
        name: this.dbName,
      },
    });

    const lineUsersDir = "line_users";

    new s3_deployment.BucketDeployment(this, "DeployLineUsers", {
      destinationBucket: lineDBBucket,
      destinationKeyPrefix: lineUsersDir,
      sources: [s3_deployment.Source.asset("./assets/line-users")],
    });

    new glue.CfnTable(this, "LineUserTable", {
      databaseName: this.dbName,
      catalogId: cdk.Stack.of(this).account,
      tableInput: {
        name: this.tableName,
        parameters: {
          classification: "json",
        },
        storageDescriptor: {
          columns: [
            {
              name: "id",
              type: "string",
            },
            {
              name: "pref",
              type: "string",
            },
          ],
          location: `s3://${lineDBBucket.bucketName}/${lineUsersDir}/`,
          inputFormat: "org.apache.hadoop.mapred.TextInputFormat",
          outputFormat:
            "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat",
          serdeInfo: {
            serializationLibrary: "org.openx.data.jsonserde.JsonSerDe",
          },
        },
      },
    });
  }
}
