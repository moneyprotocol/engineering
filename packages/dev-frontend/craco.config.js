const path = require("path")
const { CracoAliasPlugin } = require("react-app-alias-ex")
module.exports = {
  webpack: {
    configure: (webpackConfig, { paths }) => {
      // Add a fallback for 'assert' module
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        assert: require.resolve("assert/"),
      }

      return webpackConfig
    },
  },
  plugins: [
    {
      plugin: CracoAliasPlugin,
      options: {},
    },
  ],
}
