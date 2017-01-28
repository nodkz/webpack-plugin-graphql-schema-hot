# webpack-plugin-graphql-schema-hot

[![NPM version](https://img.shields.io/npm/v/webpack-plugin-graphql-schema-hot.svg)](https://www.npmjs.com/package/webpack-plugin-graphql-schema-hot)
[![npm](https://img.shields.io/npm/dt/webpack-plugin-graphql-schema-hot.svg)](https://www.npmjs.com/package/webpack-plugin-graphql-schema-hot)

This is Webpack plugin which tracks changes in your GraphQL Schema (main js file and only its dependencies) and generate `json` and `txt` files.

## Install

```
yarn add webpack-plugin-graphql-schema-hot --dev
```
or
```
npm install webpack-plugin-graphql-schema-hot --save-dev
```

## Usage with webpack.config.js

```js
import path from 'path';
import WebpackPluginGraphqlSchemaHot from 'webpack-plugin-graphql-schema-hot';

const config = {
  // ...
  plugins: [
    new WebpackPluginGraphqlSchemaHot({
      schemaPath: path.resolve(__dirname, '../schema/index.js'),
      output: {
        json: path.resolve(__dirname, '../build/schema.graphql.json'),
        txt: path.resolve(__dirname, '../build/schema.graphql.txt'),
      },
      // output: (schemaPath) => {
      //   cp.execSync(
      //     'npm run generate-schema',
      //     { cwd: path.resolve(__dirname, '../'), stdio: [0, 1, 2] }
      //   );
      // },
      runOnStart: true, // default: false
      waitOnStart: 0, // default: 0, set 2000 if you use babel-plugin-transform-relay-hot
      waitOnRebuild: 0, // default: 0, set 2000 if you use babel-plugin-transform-relay-hot
      verbose: true, // default: false
      hideErrors: false, // default: false
    }),
  ]
}
```

## Options

- **`schemaPath`**
  - **Required**
  - Type: `String`
  - Absolute path to your graphql schema js file. Only this file and its dependencies will be watched.
- **`output`**
  - **Required**
  - Type: `Function` or `Object`
  - If `Object`
    - You should provide `json` and/or `txt` properties with the absolute output file path.
  - If `Function`
    - `(schemaPath) => { /* you generation code */ }`. Sometimes you may want to generate schema in some exotic way, eg. under another babel environment. Just provide your function, which will be called instead of internal.
- **`runOnStart`**
  - Type: `Boolean`
  - Default: `false`
  - Generate schema files on start, before Webpack starts compile your files.
- **`waitOnStart`**
  - Type: `Integer`
  - Default: `0`
  - How many millisecond wait after generating schema files on start, before Webpack proceed. If you use Relay, install [babel-plugin-transform-relay-hot](https://github.com/nodkz/babel-plugin-transform-relay-hot) and set `2000`, that allows to reload `relayBabelPlugin` with new schema before Webpack proceed.
- **`waitOnRebuild`**
  - Type: `Integer`
  - Default: `0`
  - How many millisecond wait after generating schema files on rebuild, before Webpack proceed.
- **`verbose`**
  - Type: `Boolean`
  - Default: `false`
  - Show more details
- **`hideErrors`**
  - Type: `Boolean`
  - Default: `false`
  - Hide runtime plugin errors. If you provide wrong options to plugin, it will show them even `hideErrors=true`.


## Recommended modules
- [babel-plugin-transform-relay-hot](https://github.com/nodkz/babel-plugin-transform-relay-hot) 🔥 if you use `Relay`, this plugin wraps standard `babelRelayPlugin` and reload it if `schema.json` file was changed.
- [eslint-plugin-graphql](https://github.com/apollostack/eslint-plugin-graphql) 🔥 if you use `Atom` editor, this plugin may also track changes of `schema.json` file on fly.
- [js-graphql-intellij-plugin](https://github.com/jimkyndemeyer/js-graphql-intellij-plugin) 🔥 if you use `WebStorm` or any other IntelliJ IDEA editor.


## License

MIT
