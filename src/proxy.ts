import { Handler } from "./lambda/Handler";

export const handler = Handler.createProxyLambda({
  mainLambdaName: "Your main lambda name",
});
