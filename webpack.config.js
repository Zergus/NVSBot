const path = require("path");
const entry = {
  prod: "./src/main.ts",
  dev: "./src/dev.ts",
  play: "./src/play.ts",
  proxy: "./src/proxy.ts",
};

module.exports = (env) => ({
  target: "node",
  entry: entry[env.entry],
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "index.js",
    libraryTarget: "commonjs2",
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  optimization: {
    minimize: true,
  },
});
