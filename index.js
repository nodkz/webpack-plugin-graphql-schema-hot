const fs = require('fs').default || require('fs');
const minimatch = require('minimatch');
const decache = require('decache').default || require('decache');

function matchesGlobs(filePath, globs) {
  return (globs || []).some(
    glob => minimatch(filePath, glob, { matchBase: true })
  );
}

function WebpackPluginGraphqlSchemaHot(options) {
  this._canRun = true;
  const startupError = (msg) => {
    this._canRun = false;
    console.error('[WebpackPluginGraphqlSchemaHot]:\n' + msg);
  };

  const opts = options || {};
  this._isFirstRun = true;

  ///////////
  // OPTIONS
  ///////////
  this.verbose = !!opts.verbose;
  this.hideErrors = !!opts.hideErrors;
  this.runOnStart = !!opts.runOnStart;
  this.rebuildTimestamp = Infinity;
  this.waitOnStart = opts.waitOnStart || 0;
  this.waitOnRebuild = opts.waitOnRebuild || 0;
  this.excludes = opts.excludes;

  if (!opts.schemaPath || typeof opts.schemaPath !== 'string') {
    startupError(
      '`opts.schemaPath` is required and should be \n' +
      '   an absolute path to your graphql schema JS file'
    );
  } else if (!fs.existsSync(opts.schemaPath)) {
    startupError(
      '`opts.schemaPath` provided file does not exists \n' +
      '   ' + opts.schemaPath
    );
  } else {
    this.schemaPath = opts.schemaPath;
  }

  if (typeof opts.output !== 'function' && !opts.output.json && !opts.output.txt) {
    startupError(
      '`opts.output` is required and should be\n' +
      '   object with at least one property { json: \'path\', /* and/or */ txt: \'path\' }\n' +
      '   or\n' +
      '   function if you want to generate schema yourself, called when schema files was changed'
    );
  } else {
    this.output = opts.output;
  }

  ///////////
  // METHODS
  ///////////
  this.log = (msg) => {
    if (this.verbose) {
      console.log('[GraphqlSchemaHot]:', msg);
    }
  };

  this.err = (msg) => {
    if (!this.hideErrors) {
      console.error('[ERROR][GraphqlSchemaHot]:', msg);
    }
  };

  this.findSchemaEntripointModule = (compilation, absolutePath) => {
    const result = compilation.modules.filter(o => (o.resource === absolutePath));
    if (!result || !Array.isArray(result) || result.length < 1) {
      this.err('Can not found GraphQL Schema entrypoint file `' + absolutePath + '` in webpack build.');
      return {};
    }
    if (result.length > 1) {
      this.err('Something strange with Webpack. Founded more than 1 module with path `' + absolutePath + '`.');
    }
    const mod = result[0];
    if (!mod) {
      this.err('Something strange with Webpack. Founded empty module record.');
      return {};
    }
    return mod;
  };

  this.findDependencies = (module, result) => {
    if (result.modules.has(module) || result.excluded.has(module)) {
      return result; // circular dependency
    }

    if (module.buildTimestamp) {
      if (this.excludes && matchesGlobs(module.resource, this.excludes)) {
        result.excluded.add(module);
      } else {
        result.modules.add(module);
        if (this.rebuildTimestamp < module.buildTimestamp) {
          // remove current module and parent from require cache
          this.log('Updated ' + module.resource);
          decache(module.resource);
          if (module.issuer && module.issuer.resource) {
            decache(module.issuer.resource);
          }

          if (result.lastBuildTimestamp < module.buildTimestamp) {
            result.lastBuildTimestamp = module.buildTimestamp;
          }
        }
      }
    }

    if (!module.dependencies) return result;
    module.dependencies.forEach((dep) => {
      if (dep.module) {
        this.findDependencies(dep.module, result);
      }
    });
    return result;
  };

  this.handleCommonErrors = (e) => {
    if (e && e.message) {
      if (e.message.indexOf('multiple versions of GraphQL')) {
        this.err(
          'Multiple versions of GraphQL installed in your node_modules directory.\n' +
          '  - Please completely remove node_modules folder and re-install all packages from scratch.\n' +
          '  - OR go to node_modules/webpack-plugin-graphql-schema-hot/node_modules/ and remove graphql-js package from there.\n' +
          'This package uses `graphql-js` as peerDependency, so if you got this error then it seems that your package manager by mistake install multiple `graphql-js` packages.'
        );
      } else {
        this.err(e.message);
      }
    } else {
      this.err(e);
    }
  };

  this.generateGraphqlIntrospectionFiles = (schemaPath, jsonPath, txtPath, done) => {
    const graphql = require('graphql').default || require('graphql');
    decache(schemaPath);
    const schema = require(schemaPath).default || require(schemaPath);

    if (jsonPath) {
      graphql.graphql(schema, graphql.introspectionQuery).then((result) => {
        if (result.errors) {
          this.err('In schema introspection: \n' + JSON.stringify(result.errors, null, 2));
        } else {
          fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
          this.log('Write new ' + jsonPath);
        }
      })
      .catch((e) => this.handleCommonErrors(e))
      .then(() => {
        if (done) done();
      });
    }

    if (txtPath) {
      try {
        fs.writeFileSync(txtPath, graphql.printSchema(schema));
      } catch (e) {
        this.handleCommonErrors(e);
      }
      this.log('Write new ' + txtPath);
    }

    if (!jsonPath) {
      // otherwise jsonPath Promise should call done()
      if (done) done();
    }
  };

  this.buildSchema = (done) => {
    try {
      if (typeof this.output === 'function') {
        Promise
          .resolve(this.output(this.schemaPath))
          .then(() => done())
          .catch((e) => {
            this.err('\n' + e);
            done();
          });
      } else {
        this.generateGraphqlIntrospectionFiles(
          this.schemaPath,
          this.output.json,
          this.output.txt,
          done
        );
      }
    } catch (e) {
      this.err('\n' + e);
      done();
    }
  };
}

WebpackPluginGraphqlSchemaHot.prototype.start = function (compiler, done) {
  if (this._isFirstRun && this.runOnStart) {
    this.log('Build GraphQL Schema files due opts.runOnStart = true');
    this.buildSchema(() => {
      if (this.waitOnStart) {
        this.log('Freeze Webpack due opts.waitOnStart = ' + this.waitOnStart);
        setTimeout(done, this.waitOnStart);
      } else {
        done();
      }
    });
  } else {
    done();
  }
};

WebpackPluginGraphqlSchemaHot.prototype.afterCompile = function (compilation, done) {
  if (!this._canRun) return;

  const result = {
    lastBuildTimestamp: this.rebuildTimestamp,
    modules: new Set(),
    excluded: new Set(),
  };
  const entryModule = this.findSchemaEntripointModule(compilation, this.schemaPath);
  this.findDependencies(entryModule, result);

  this.log('Watched changes in ' + result.modules.size + ' files');

  if (this.rebuildTimestamp < result.lastBuildTimestamp) {
    this.log('GraphQL Schema files was changed. Run rebuild...');
    this.buildSchema(() => {
      if (this.waitOnRebuild) {
        this.log('Freeze Webpack due opts.waitOnRebuild = ' + this.waitOnRebuild);
        setTimeout(done, this.waitOnRebuild);
      } else {
        done();
      }
    });
  } else {
    done();
  }

  if (this._isFirstRun) {
    this._isFirstRun = false;
    result.lastBuildTimestamp = Date.now();
  }
  this.rebuildTimestamp = result.lastBuildTimestamp;
};

WebpackPluginGraphqlSchemaHot.prototype.apply = function (compiler) {
  this.compiler = compiler;
  compiler.plugin('run', this.start.bind(this));
  compiler.plugin('watch-run', this.start.bind(this));
  compiler.plugin('after-compile', this.afterCompile.bind(this));
};

module.exports = WebpackPluginGraphqlSchemaHot;
