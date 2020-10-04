const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

const devOverride = {
  mode: "development",
  devtool: "eval-source-map",
};

const prodOverride = {
  mode: "production",
};

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
        test: /\.ts(x)$/,
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
  ],
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  target: "web",
  ...(process.env.NODE_ENV === "production" ? prodOverride : devOverride),
};
