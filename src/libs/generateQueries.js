/* eslint-disable max-depth */
const {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLBoolean
} = require('graphql');
const {
  defaultListArgs,
  defaultArgs
} = require('graphql-sequelize');
const camelCase = require('camelcase');
const { generateGraphQLField } = require('./generateTypes');
const { includeArguments, sanitizeField } = require('../utils');

module.exports = (options) => {

  const { query } = require('../resolvers')(options);

  /**
  * Returns a root `GraphQLObjectType` used as query for `GraphQLSchema`.
  *
  * It creates an object whose properties are `GraphQLObjectType` created
  * from Sequelize models.
  * @param {*} models The sequelize models used to create the root `GraphQLSchema`
  */
  return (models, outputTypes = {}, inputTypes = {}) => {

    const createQueriesFor = {};

    for (const outputTypeName in outputTypes) {
      const model = models[outputTypeName];

      // model must have atleast one query to implement.
      if (model && (!model.graphql.excludeQueries.includes('fetch') || Object.keys(model.graphql.queries || {}).length)) {
        createQueriesFor[outputTypeName] = outputTypes[outputTypeName];
      }
    }

    return new GraphQLObjectType({
      name: 'Root_Query',
      fields: Object.keys(createQueriesFor).reduce((allQueries, modelTypeName) => {

        const queries = {};
        const modelType = outputTypes[modelTypeName];
        const model = models[modelType.name];
        const paranoidType = model.graphql.paranoid && model.options.paranoid ? { paranoid: { type: GraphQLBoolean } } : {};
        const aliases = model.graphql.alias;

        if (!model.graphql.excludeQueries.includes('fetch')) {
          queries[camelCase(aliases.fetch || modelType.name, { pascalCase: true })] = {
            type: new GraphQLList(modelType),
            args: Object.assign(defaultArgs(model), defaultListArgs(), includeArguments(), paranoidType),
            resolve: (source, args, context, info) => {
              return query(model, modelType.name, source, args, context, info);
            }
          }
        }

        // Setup Custom Queries
        for (const query in (model.graphql.queries || {})) {

          const currentQuery = model.graphql.queries[query];
          const type = currentQuery.output ? generateGraphQLField(currentQuery.output, outputTypes) : GraphQLInt;
          const args = Object.assign(
            {}, defaultListArgs(), includeArguments(), paranoidType,
            currentQuery.input ? { [sanitizeField(currentQuery.input)]: { type: generateGraphQLField(currentQuery.input, inputTypes) } } : {},
          );
          const resolve = async (source, args, context, info) => {

            await options.authorizer(source, args, context, info);

            return currentQuery.resolver(source, args, context, info);
          }

          queries[camelCase(query, { pascalCase: true })] = { type, args, resolve };

        }

        return Object.assign(allQueries, queries);

      }, {})
    });
  };

};