import { Construct } from "constructs";
import {
  aws_iam as iam,
  aws_stepfunctions as sfn,
  aws_events as events,
  aws_secretsmanager as secretsmanager,
} from "aws-cdk-lib";
import { Pass, StateMachine } from "aws-cdk-lib/aws-stepfunctions";
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Config } from "../../config";

type StateMachineConstructProps = {
  athenaWgName: string;
  dbName: string;
  tableName: string;
} & Pick<Config, "connectionArn" | "connectionName" | "connectionSecretArn">;

export class StateMachineConstruct extends Construct {
  constructor(scope: Construct, id: string, props: StateMachineConstructProps) {
    super(scope, id);

    const sfnRole = new iam.Role(this, "Role", {
      assumedBy: new iam.ServicePrincipal("states.amazonaws.com"),
    });
    sfnRole.addToPolicy(
      new iam.PolicyStatement({
        resources: ["*"],
        actions: [
          "glue:GetDatabase",
          "glue:GetTable",
          "states:InvokeHTTPEndpoint",
        ],
      }),
    );

    const query = `
SELECT
    audiences
FROM
    (SELECT 
    	ARRAY_AGG(JSON_PARSE(JSON_OBJECT('id': id))) AS audiences
    FROM
        "${props.dbName}"."${props.tableName}"
    WHERE
        pref = '兵庫県'
    )    
`;

    const connection = events.Connection.fromConnectionAttributes(
      this,
      "HttpConnection",
      {
        connectionArn: props.connectionArn,
        connectionName: props.connectionName,
        connectionSecretArn: props.connectionSecretArn,
      },
    );

    new sfn.StateMachine(this, "Resource", {
      stateMachineName: "CreateLineAudiencesSM",
      comment: "LINEのAudienceを作成するステートマシン",
      role: sfnRole,
      definitionBody: sfn.DefinitionBody.fromChainable(
        new tasks.AthenaStartQueryExecution(this, "StartQueryExecution", {
          queryString: query,
          integrationPattern: sfn.IntegrationPattern.RUN_JOB,
          comment: "AthenaのクエリでLINEユーザーアカウントの一覧を取得する",
          workGroup: props.athenaWgName,
          resultSelector: {
            "QueryExecutionId.$": "$.QueryExecution.QueryExecutionId",
          },
          resultPath: "$.StartQueryExecutionResult",
        })
          .next(
            new tasks.AthenaGetQueryResults(this, "GetQueryResult", {
              queryExecutionId: sfn.JsonPath.stringAt(
                "$.StartQueryExecutionResult.QueryExecutionId",
              ),
              resultSelector: {
                "audiences.$": "$.ResultSet.Rows[1].Data[0].VarCharValue",
              },
              resultPath: "$.GetQueryResultResult",
            }),
          )
          .next(
            new tasks.HttpInvoke(this, "InvokeHTTPEndpoint", {
              apiRoot:
                "https://api.line.me",
              apiEndpoint: sfn.TaskInput.fromText("/v2/bot/audienceGroup/upload"),
              connection: connection,
              method: sfn.TaskInput.fromText("POST"),
              inputPath: "$.GetQueryResultResult.audiences",
              body: sfn.TaskInput.fromObject({
                // TODO 動的な値を設定するようにする
                description: "AthenaとStepFunctionsで自動生成",
                uploadDescription: "YYYY-MM-DD",
                "audiences.$": "States.StringToJson($)",
              }),
            }),
          ),
      ),
    });
  }
}
