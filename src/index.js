const assert = require('assert');

const cls = require('cls-hooked');
const TRANSACTION_NAMESPACE = 'sequelize-graphql-schema';
const sequelizeNamespace = cls.createNamespace(TRANSACTION_NAMESPACE);

// library options
const defaultOptions = {
  exclude: [], // exclude these models from graphql
  includeArguments: {}, // include these arguments to all queries/mutations
  remote: {},
  dataloader: false,
  transactionedMutations: true,
  privateMode: false,
  types: {}, // custom graphql types
  // executes after all queries/mutations
  logger() {
    return Promise.resolve();
  },
  // executes before all queries/mutations
  authorizer() {
    return Promise.resolve();
  },
  // executes when exceptions are thrown
  errorHandler: {
    'ETIMEDOUT': { statusCode: 503 }
  }
};

// Model options model.graphql
const defaultModelGraphqlOptions = {
  attributes: {
    exclude: [], // list attributes which are to be ignored in Model Input
    include: {}, // attributes in key:type format which are to be included in Model Input
    import: []
  },
  scopes: null, // common scope to be applied on all find/update/destroy operations
  alias: {}, // rename default queries/mutations to specified custom name
  bulk: [], // enable bulk options ['create', 'destroy', 'edit']
  mutations: {}, // user defined custom mutations
  queries: {}, // user defined custom queries
  excludeMutations: [], // exclude one or more default mutations ['create', 'destroy', 'update']
  excludeQueries: [], // exclude one or more default queries ['fetch']
  extend: {}, // extend/after hook default queries/mutations behavior {fetch, create, destroy, update}
  before: {}, // before hook for default queries/mutations behavior {fetch, create, destroy, update}
  overwrite: {} // overwrite default queries/mutations behavior {fetch, create, destroy, update}
};

const { generateModelTypes } = require('./libs/generateTypes');
const options = {};

const errorHandler = (error) => {
  for (const name in options.errorHandler) {
    if (error.message.indexOf(name) > -1) {
      Object.assign(error, options.errorHandler[name]);
      break;
    }
  }

  return error;
};

function generateSchema(models, context) {

  assert(models.Sequelize, 'Sequelize not found as models.Sequelize.');
  assert(models.sequelize, 'sequelize instance not found as models.sequelize.');

  options.Sequelize = models.Sequelize;
  options.sequelize = models.sequelize;

  options.Sequelize.useCLS(sequelizeNamespace);

  const modelsIncluded = {};

  for (const modelName in models) {

    const model = models[modelName];

    if (model instanceof options.Sequelize.Model && options.exclude.indexOf(modelName) === -1) {
      model.graphql = Object.assign({}, model.graphql || defaultModelGraphqlOptions);
      modelsIncluded[modelName] = model;
    }

  }

  const modelTypes = generateModelTypes(modelsIncluded, options.types || {});

  return {
    query: queries(availableModels, modelTypes.outputTypes, modelTypes.inputTypes),
    mutation: mutations(availableModels, modelTypes.inputTypes, modelTypes.outputTypes)
  };

}

module.exports = (_options) => {
  Object.assign(options, _options, defaultOptions);

  return {
    generateSchema
  };
};