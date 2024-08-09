#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LineAudienceStack } from "../lib/line-audience-stack";
import { getConfig } from "../config";

const app = new cdk.App();
const config = getConfig();

new LineAudienceStack(app, "LineAudienceStack", {
  config,
});
