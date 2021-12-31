const CopyWebpackPlugin = require("copy-webpack-plugin");
module.exports = {
  "stories": [
    "../src/**/examples.ts"
  ],
  "addons": [
    {
      name: "storybook-addon-turbo-build",
      options: {
        optimizationLevel: 3
      }
    }
  ],
  "framework": "linki-ui-storybook",
  "webpackFinal": async (config) => {
    config.plugins.push(new CopyWebpackPlugin({
      patterns: [
        { from: "node_modules/@primer/css/dist/primer.css" }
      ]
    }));
    return config;
  }
};
