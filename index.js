// Inspired by (but complete rewrite of) requirejs-metagen.
let _       = require('lodash/fp') // Add lodash helper functions.
let Promise = require('bluebird')  // Replace promises with the Bluebird Promises library. ("Bluebird cuts corners" -- yikes!)
let readDir = Promise.promisify(require('recursive-readdir')) // Lists all files in a certain directory and all its sub-directories.
let fs      = Promise.promisifyAll(require('fs')) // Add the filesystem library.

// Define path Utils.

// Get all the file names in a certain directory and its sub-directories, excluding the directory path.
let filesRelative = (dir, exclusions) => readDir(dir, exclusions).map(filename => filename.slice(dir.length))

// Get a file's name without its extension.
let noExt = file => file.slice(0, _.lastIndexOf('.', file))

// Slightly more convenient way to return a function which performs a certain regex match on a string.
let stringMatch = regex => str => regex.test(str)

// ====================================================================================

// Core.

// Create a default filter.
let filter = _.filter(stringMatch(/.js|.html|.jsx|.ts|.coffee|.less|.css|.sass|.hbs|.ejs/))


// Define the metagen function.
let metagen = dir => filesRelative(dir.path, dir.exclusions || [dir.output || '__all.js'])
    .then(dir.filter || filter)
    .then(files => fs.writeFileAsync(dir.path + (dir.output || '__all.js'), dir.format(files, dir)))


// Define various output formats.
metagen.formats = {}
metagen.formats.commonJS = files => `define(function(require) {
    return {
        ${files.map(noExt).map(file => `'${file}': require('./${file}')`).join(',\n        ')}
    };
});`
metagen.formats.amd = files => `define([
    ${files.map(file => `'${noExt(file)}'`).join(',\n    ')}
], function() {
    return {
        ${files.map((file, i) => `'${noExt(file)}': arguments[${i}]`).join(',\n        ')}
    }
});`

// Deep Formats.
let deepKeys = _.map(_.flow(noExt, _.replace(/\//g, '.')))
let stringify = x => JSON.stringify(x, null, 4)
let indent = _.replace(/\n/g, '\n    ')
let unquote = _.replace(/"require(.*)'\)"/g, "require$1')")
let deepify = _.flow(_.zipObjectDeep, stringify, indent, unquote)

metagen.formats.deepCommonJS = files => `define(function(require) {
    return ${deepify(deepKeys(files), files.map(file => `require('./${noExt(file)}')`))};
});`
metagen.formats.deepAMD = files => `define([
    ${files.map(file => `'${noExt(file)}'`).join(',\n    ')}
], function() {
    return ${deepify(deepKeys(files), files.map((file, i) => `arguments[${i}]`))};
});`

module.exports = metagen
