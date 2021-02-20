const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const webpack = require("webpack");

const devOverride = {
  mode: "development",
  devtool: "eval-source-map",
};

const prodOverride = {
  mode: "production",
};

const devConfig = {
  PROXY_SERVER: JSON.stringify("/proxy/"),
  GDRIVE_APP_DIR_NAME: JSON.stringify("binder (Dev)"),
  // these keys are public as they get to the end code anyway. They are obfuscated to make difficult to scrap them from the repo
  GDRIVE_CLIENT_ID: JSON.stringify(
    "Mzk4NjgzNTAxOTk3LWhyN2lpajQ2b3ZuZmdlNDJqYmk1amU4dWgxNmJkamozLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t"
  ),
  GDRIVE_API_KEY: JSON.stringify(
    "QUl6YVN5QmhfcGpVdGZYOFFjV1NGVVFzZWtMcHg5bV82dzBPTGZv"
  ),
};

const prodConfig = {
  PROXY_SERVER: JSON.stringify(
    "https://purple-sun-fdbf.friendly-apps.workers.dev/"
  ),
  GDRIVE_APP_DIR_NAME: JSON.stringify("binder"),
  // these keys are public as they get to the end code anyway. They are obfuscated to make difficult to scrap them from the repo
  GDRIVE_CLIENT_ID: JSON.stringify(
    "Mzk4NjgzNTAxOTk3LWhyN2lpajQ2b3ZuZmdlNDJqYmk1amU4dWgxNmJkamozLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t"
  ),
  GDRIVE_API_KEY: JSON.stringify(
    "QUl6YVN5QmhfcGpVdGZYOFFjV1NGVVFzZWtMcHg5bV82dzBPTGZv"
  ),
};

const iconFileName =
  process.env.NODE_ENV === "production" ? "notebook-icon" : "notebook-icon-dev";

module.exports = {
  entry: {
    main: "./src/index.tsx",
  },
  output: {
    filename: "[name].js",
    path: __dirname + "/build",
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ts(x?)$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      chunks: ["main"],
      templateContent: ({ htmlWebpackPlugin }) => `
    <html lang="en">
      <head>
        <title>binder</title>
        <link href="primer.css" rel="stylesheet" />
        <link rel="icon" href="${iconFileName}.svg" type="image/svg+xml"/>
        <link rel="mask-icon" href="${iconFileName}.svg" color="#24292e">
        ${htmlWebpackPlugin.tags.headTags}
      <body>
      </head>
        ${htmlWebpackPlugin.tags.bodyTags}
      </body>
    </html>
  `,
      inject: false,
    }),
    new CopyWebpackPlugin({ patterns: [{ from: "assets" }] }),
    new webpack.DefinePlugin(
      process.env.NODE_ENV === "production" ? prodConfig : devConfig
    ),
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  target: "web",
  ...(process.env.NODE_ENV === "production" ? prodOverride : devOverride),
  devServer: {
    proxy: {
      "/proxy": {
        target: "ignored",
        changeOrigin: true,
        pathRewrite: (path, req) =>
          new URL(req.url.slice("/proxy/".length)).pathname,
        router: (req) => new URL(req.url.slice("/proxy/".length)).origin,
      },
    },
  },
};
