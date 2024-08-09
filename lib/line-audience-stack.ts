import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { StateMachineConstruct } from "./constructs/statemachine";
import { Config } from "../config";
import { DwhConstruct } from "./constructs/dwh";

type LineAudienceStackProps = cdk.StackProps & {
  config: Config;
};

export class LineAudienceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LineAudienceStackProps) {
    super(scope, id, props);

    const dwh = new DwhConstruct(this, "Dwh", {});

    new StateMachineConstruct(this, "StateMachine", {
      athenaWgName: dwh.athenaWgName,
      dbName: dwh.dbName,
      tableName: dwh.tableName,
      connectionArn: props.config.connectionArn,
      connectionName: props.config.connectionName,
      connectionSecretArn: props.config.connectionSecretArn,
    });
  }
}
