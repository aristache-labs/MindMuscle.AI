/* eslint-disable prettier/prettier */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      ["@babel/plugin-transform-class-static-block", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
      ["@babel/plugin-transform-class-properties", { loose: true }],
      "react-native-reanimated/plugin",
      [
        "module-resolver",
        {
          alias: {
            buffer: "buffer",
            "web-streams-polyfill/ponyfill/es6": "web-streams-polyfill/dist/ponyfill.es6.js",
            "@prisma/client": "@prisma/client/runtime/index",
          },
        },
      ],
    ],
  };
};
