/* jshint node:true */
'use strict';

/*
 * in order to `import` an npm module from the es6 source it must:
 *  - be listed in the vendored node modules
 *  - have its own "lib" dir locally that contains es6 code
 */

var Funnel = require('broccoli-funnel');
var ESTranspiler = require('broccoli-babel-transpiler');
var Merge = require('broccoli-merge-trees');
var Concat = require('broccoli-concat');
var resolveSourceToAbsolute = require('../utils/resolve-source-to-absolute');
var vendoredTreeBuilder = require('./vendored-tree-builder');
var amdLoader = require('broccoli-amd-loader');
var validateOptions = require('../utils/validate-options');

function treeBuilder(options) {
  validateOptions(options);

  var libDir = options.libDirName,
      packageName = options.packageName;

  var outputFileName = options.outputFileName || packageName;
  outputFileName += '.js';
  var outputDir = options.isGlobal ? 'global' : 'amd';
  var outputPath = outputDir + '/' + outputFileName;

  // put in a destDir with the same package name as the name of the moduleRoot
  // that we want so that named modules become <moduleRoot>/filename aka
  // 'content-kit-editor/filename'
  var tree = new Funnel(libDir, {
    destDir: '/' + packageName
  });

  tree = new ESTranspiler(tree, {
    moduleIds: true,
    modules: 'amdStrict',

    // Transforms /index.js files to use their containing directory name
    getModuleId: function (name) {
      return name.replace(/\/index$/, '');
    },
    resolveModuleSource: function (source, filename) {
      return resolveSourceToAbsolute(source, filename);
    }
  });

  var concatOptions = {
    header: '',
    headerFiles: [],
    inputFiles: ['**/*.js'],
    footerFiles: [],
    footer: '',

    outputFile: '/' + outputPath
  };

  var vendoredTree = vendoredTreeBuilder.build(options.vendoredModules);
  tree = new Merge([tree, vendoredTree]);

  if (options.loader) {
    tree = amdLoader(tree, {
      destDir: '/loader.js'
    });
    concatOptions.headerFiles.push('loader.js/loader.js');
  }

  if (options.isGlobal) {
    var registerGlobal = options.registerGlobalExport;
    concatOptions.header = ';(function() {';
    concatOptions.footer = [
      'require("' + packageName + '")["' + registerGlobal + '"](window, document);',
      '})();'
    ].join('\n');
  }

  tree = new Concat(tree, concatOptions);

  return tree;
}

module.exports = {
  build: treeBuilder
};
