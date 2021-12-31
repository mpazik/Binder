const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const SpeedMeasurePlugin = require("speed-measure-webpack-plugin");
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require("webpack");

const sharedConfig = ({ envVariables, productIcon }) => ({
  entry: {
    main: "./src/index.ts",
  },
  output: {
    filename: "[name].js",
    path: __dirname + "/build",
    publicPath: '/',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ts$/i,
        use: {
          loader: "ts-loader",
          options: { transpileOnly: true },
        },
        exclude: [/node_modules/, /\.test\.ts$/i],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/pages/about.html",
      filename: "./about.html",
      productIcon,
      chunks: ["main"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/about.html",
      filename: "./index.html",
      productIcon,
      chunks: []
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/directory.html",
      filename: "./directory.html",
      productIcon,
      chunks: ["main"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/404.html",
      filename: "./404.html",
      productIcon,
      chunks: ["main"]
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/privacy.html",
      filename: "./privacy.html",
      productIcon,
      chunks: ["main"]
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: "assets" },
        { from: "node_modules/@primer/css/dist/primer.css" },
        { from: "node_modules/pdfjs-dist/build/pdf.worker.js" },
      ],
    }),
    new webpack.DefinePlugin(envVariables),
    // new BundleAnalyzerPlugin()
  ],
  resolve: {
    extensions: [".js", ".ts", ".jsonld"],
  },
  target: "web",
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    splitChunks: {
      chunks: "all",
    },
  },
});

const devEnv = {
  PROXY_SERVER: JSON.stringify("/proxy/"),
  GDRIVE_APP_DIR_NAME: JSON.stringify("docland (Dev)"),
  // these keys are public as they get to the end code anyway. They are obfuscated to make difficult to scrap them from the repo
  GDRIVE_CLIENT_ID: JSON.stringify(
    "Mzk4NjgzNTAxOTk3LWhyN2lpajQ2b3ZuZmdlNDJqYmk1amU4dWgxNmJkamozLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t",
  ),
  GDRIVE_API_KEY: JSON.stringify(
    "QUl6YVN5QmhfcGpVdGZYOFFjV1NGVVFzZWtMcHg5bV82dzBPTGZv",
  ),
  ANALYTICS_KEY: JSON.stringify(false),
};

const devConfig = (() => {
  const sharedDevConfig = sharedConfig({
    envVariables: devEnv,
    productIcon: "/notebook-icon-dev.svg",
  });
  return {
    ...sharedDevConfig,
    entry: {
      ...sharedDevConfig.entry,
    },
    mode: "development",
    devtool: "eval-source-map",
    plugins: [
      ...sharedDevConfig.plugins,
      new HtmlWebpackPlugin({
        filename: 'examples.html',
        chunks: ["examples"],
        templateContent: ({ htmlWebpackPlugin }) => `
    <html lang="en">
      <head>
        <title>Examples</title>
        <link href="primer.css" rel="stylesheet" />
        ${htmlWebpackPlugin.tags.headTags}
      <body>
      </head>
        ${htmlWebpackPlugin.tags.bodyTags}
      </body>
    </html>
  `,
        inject: false,
      }),
    ],
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
      historyApiFallback: {
        rewrites: [
          { from: /^\/privacy/, to: '/privacy.html' },
          { from: /^\/directory/, to: '/directory.html' },
          { from: /^\/about/, to: '/about.html' },
          { from: /./, to: '/404.html' },
        ],
      },
    },
  };
})();

const prodEnv = {
  PROXY_SERVER: JSON.stringify(
    "https://docland-proxy.friendly-apps.workers.dev/",
  ),
  GDRIVE_APP_DIR_NAME: JSON.stringify("docland"),
  // these keys are public as they get to the end code anyway. They are obfuscated to make difficult to scrap them from the repo
  GDRIVE_CLIENT_ID: JSON.stringify(
    "Mzk4NjgzNTAxOTk3LWhyN2lpajQ2b3ZuZmdlNDJqYmk1amU4dWgxNmJkamozLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t",
  ),
  GDRIVE_API_KEY: JSON.stringify(
    "QUl6YVN5QmhfcGpVdGZYOFFjV1NGVVFzZWtMcHg5bV82dzBPTGZv",
  ),
  ANALYTICS_KEY: JSON.stringify("cGhjX2c1djR3V0p4MHdnTVNMc3B1UHpFMnVjYW1KWEY4dk82dUhNWWFTT04yNUg="),
};

const prodConfig = {
  ...sharedConfig({
    envVariables: prodEnv,
    productIcon: "/notebook-icon.svg",
  }),
  mode: "production",
};


const smp = new SpeedMeasurePlugin();
module.exports = smp.wrap(process.env.NODE_ENV === "production" ? prodConfig : devConfig);
