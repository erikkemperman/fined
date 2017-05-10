'use strict';

var fs = require('fs');
var path = require('path');

var isString = require('lodash.isstring');
var isFunction = require('lodash.isfunction');
var isPlainObject = require('lodash.isplainobject');
var isEmpty = require('lodash.isempty');
var pick = require('lodash.pick');
var assignWith = require('lodash.assignwith');

var expandTilde = require('expand-tilde');
var parsePath = require('parse-filepath');

function assignNullish(objValue, srcValue) {
  return (srcValue == null ? objValue : srcValue);
}

function defaults(mainObj, defaultObj) {
  return assignWith({}, defaultObj, mainObj, assignNullish);
}

function fined(pathObj, defaultObj) {
  var expandedPath = expandPath(pathObj, defaultObj);
  return expandedPath ? findWithExpandedPath(expandedPath) : null;
}

function expandPath(pathObj, defaultObj) {
  if (!isPlainObject(defaultObj)) {
    defaultObj = {};
  }

  if (isString(pathObj)) {
    pathObj = { path: pathObj };
  }

  if (!isPlainObject(pathObj)) {
    pathObj = {};
  }

  pathObj = defaults(pathObj, defaultObj);

  var filePath;
  if (!isString(pathObj.path)) {
    return null;
  }
  // Execution of toString is for a String object.
  if (isString(pathObj.name) && pathObj.name) {
    if (pathObj.path) {
      filePath = expandTilde(pathObj.path.toString());
      filePath = path.join(filePath, pathObj.name.toString());
    } else {
      filePath = pathObj.name.toString();
    }
  } else {
    filePath = expandTilde(pathObj.path.toString());
  }

  var extArr = createExtensionArray(pathObj.extensions);
  var extMap = createExtensionMap(pathObj.extensions);

  var basedir = isString(pathObj.cwd) ? pathObj.cwd.toString() : '.';
  basedir = path.resolve(expandTilde(basedir));

  var findUp = !!pathObj.findUp;
  var callback = isFunction(pathObj.callback) ? pathObj.callback : false;

  var parsed = parsePath(filePath);
  if (parsed.isAbsolute) {
    filePath = filePath.slice(parsed.root.length);
    findUp = false;
    basedir = parsed.root;
  } else if (parsed.root) { // Expanded path has a drive letter on Windows.
    filePath = filePath.slice(parsed.root.length);
    basedir = path.resolve(parsed.root);
  }

  return {
    path: filePath,
    basedir: basedir,
    findUp: findUp,
    callback: callback,
    extArr: extArr,
    extMap: extMap,
  };
}

function findWithExpandedPath(expanded) {
  var basedir = expanded.basedir;
  var last = null;

  do {
    var found = expanded.findUp ?
      findUpFile(basedir, expanded.path, expanded.extArr) :
      findFile(basedir, expanded.path, expanded.extArr);

    if (!found) {
      return last;
    }

    if (expanded.extMap) {
      found.extension = pick(expanded.extMap, found.extension);
    }

    if (!expanded.callback || !expanded.callback(found) || !expanded.findUp) {
      return found;
    }

    basedir = path.dirname(basedir);
    last = found;
  } while (true);
}

function findFile(basedir, relpath, extArr) {
  var noExtPath = path.resolve(basedir, relpath);
  for (var i = 0, n = extArr.length; i < n; i++) {
    var filepath = noExtPath + extArr[i];
    try {
      fs.statSync(filepath);
      return { path: filepath, extension: extArr[i] };
    } catch (e) {}
  }

  return null;
}

function findUpFile(basedir, filepath, extArr) {
  var lastdir;
  do {
    var found = findFile(basedir, filepath, extArr);
    if (found) {
      return found;
    }

    lastdir = basedir;
    basedir = path.dirname(basedir);
  } while (lastdir !== basedir);

  return null;
}

function createExtensionArray(exts) {
  if (isString(exts)) {
    return [exts];
  }

  if (Array.isArray(exts)) {
    exts = exts.filter(isString);
    return (exts.length > 0) ? exts : [''];
  }

  if (isPlainObject(exts)) {
    exts = Object.keys(exts);
    return (exts.length > 0) ? exts : [''];
  }

  return [''];
}

function createExtensionMap(exts) {
  if (!isPlainObject(exts)) {
    return null;
  }

  if (isEmpty(exts)) {
    return { '': null };
  }

  return exts;
}

module.exports = fined;
