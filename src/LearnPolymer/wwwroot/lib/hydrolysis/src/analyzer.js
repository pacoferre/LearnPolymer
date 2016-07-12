/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const dom5 = require('dom5');
const url = require('url');
const docs = require('./ast-utils/docs');
const file_loader_1 = require('./loader/file-loader');
const import_parse_1 = require('./ast-utils/import-parse');
const js_parse_1 = require('./ast-utils/js-parse');
const noop_resolver_1 = require('./loader/noop-resolver');
const string_resolver_1 = require('./loader/string-resolver');
const fs_resolver_1 = require('./loader/fs-resolver');
const xhr_resolver_1 = require('./loader/xhr-resolver');
const error_swallowing_fs_resolver_1 = require('./loader/error-swallowing-fs-resolver');
function reduceMetadata(m1, m2) {
    return {
        elements: m1.elements.concat(m2.elements),
        features: m1.features.concat(m2.features),
        behaviors: m1.behaviors.concat(m2.behaviors),
    };
}
var EMPTY_METADATA = { elements: [], features: [], behaviors: [] };
/**
 * A database of Polymer metadata defined in HTML
 */
class Analyzer {
    /**
     * @param  {boolean} attachAST  If true, attach a parse5 compliant AST
     * @param  {FileLoader=} loader An optional `FileLoader` used to load external
     *                              resources
     */
    constructor(attachAST, loader) {
        /**
         * A list of all elements the `Analyzer` has metadata for.
         */
        this.elements = [];
        /**
         * A view into `elements`, keyed by tag name.
         */
        this.elementsByTagName = {};
        /**
         * A list of API features added to `Polymer.Base` encountered by the
         * analyzer.
         */
        this.features = [];
        /**
         * The behaviors collected by the analysis pass.
         */
        this.behaviors = [];
        /**
         * The behaviors collected by the analysis pass by name.
         */
        this.behaviorsByName = {};
        /**
         * A map, keyed by absolute path, of Document metadata.
         */
        this.html = {};
        /**
         * A map, keyed by path, of HTML document ASTs.
         */
        this.parsedDocuments = {};
        /**
         * A map, keyed by path, of JS script ASTs.
         *
         * If the path is an HTML file with multiple scripts,
         * the entry will be an array of scripts.
         */
        this.parsedScripts = {};
        /**
         * A map, keyed by path, of document content.
         */
        this._content = {};
        this.loader = loader;
    }
    load(href) {
        return this.loader.request(href).then((content) => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    this._content[href] = content;
                    resolve(this._parseHTML(content, href));
                }, 0);
            }).catch(function (err) {
                console.error("Error processing document at " + href);
                throw err;
            });
        });
    }
    ;
    /**
     * Returns an `AnalyzedDocument` representing the provided document
     * @private
     * @param  {string} htmlImport Raw text of an HTML document
     * @param  {string} href       The document's URL.
     * @return {AnalyzedDocument}       An  `AnalyzedDocument`
     */
    _parseHTML(htmlImport, href) {
        if (href in this.html) {
            return this.html[href];
        }
        var depsLoaded = [];
        var depHrefs = [];
        var metadataLoaded = Promise.resolve(EMPTY_METADATA);
        var parsed;
        try {
            parsed = import_parse_1.importParse(htmlImport, href);
        }
        catch (err) {
            console.error('Error parsing!');
            throw err;
        }
        var htmlLoaded = Promise.resolve(parsed);
        if (parsed.script) {
            metadataLoaded = this._processScripts(parsed.script, href);
        }
        var commentText = parsed.comment.map(function (comment) {
            return dom5.getTextContent(comment);
        });
        var pseudoElements = docs.parsePseudoElements(commentText);
        for (const element of pseudoElements) {
            element.contentHref = href;
            this.elements.push(element);
            this.elementsByTagName[element.is] = element;
        }
        metadataLoaded = metadataLoaded.then(function (metadata) {
            var metadataEntry = {
                elements: pseudoElements,
                features: [],
                behaviors: []
            };
            return [metadata, metadataEntry].reduce(reduceMetadata);
        });
        depsLoaded.push(metadataLoaded);
        if (this.loader) {
            var baseUri = href;
            if (parsed.base.length > 1) {
                console.error("Only one base tag per document!");
                throw "Multiple base tags in " + href;
            }
            else if (parsed.base.length == 1) {
                var baseHref = dom5.getAttribute(parsed.base[0], "href");
                if (baseHref) {
                    baseHref = baseHref + "/";
                    baseUri = url.resolve(baseUri, baseHref);
                }
            }
            for (const link of parsed.import) {
                var linkurl = dom5.getAttribute(link, 'href');
                if (linkurl) {
                    var resolvedUrl = url.resolve(baseUri, linkurl);
                    depHrefs.push(resolvedUrl);
                    depsLoaded.push(this._dependenciesLoadedFor(resolvedUrl, href));
                }
            }
            for (const styleElement of parsed.style) {
                if (polymerExternalStyle(styleElement)) {
                    var styleHref = dom5.getAttribute(styleElement, 'href');
                    if (href) {
                        styleHref = url.resolve(baseUri, styleHref);
                        depsLoaded.push(this.loader.request(styleHref).then((content) => {
                            this._content[styleHref] = content;
                            return {};
                        }));
                    }
                }
            }
        }
        const depsStrLoaded = Promise.all(depsLoaded)
            .then(function () { return depHrefs; })
            .catch(function (err) { throw err; });
        this.parsedDocuments[href] = parsed.ast;
        this.html[href] = {
            href: href,
            htmlLoaded: htmlLoaded,
            metadataLoaded: metadataLoaded,
            depHrefs: depHrefs,
            depsLoaded: depsStrLoaded
        };
        return this.html[href];
    }
    ;
    _processScripts(scripts, href) {
        var scriptPromises = [];
        scripts.forEach((script) => {
            scriptPromises.push(this._processScript(script, href));
        });
        return Promise.all(scriptPromises).then(function (metadataList) {
            // TODO(ajo) remove this cast.
            var list = metadataList;
            return list.reduce(reduceMetadata, EMPTY_METADATA);
        });
    }
    ;
    _processScript(script, href) {
        const src = dom5.getAttribute(script, 'src');
        var parsedJs;
        if (!src) {
            try {
                parsedJs = js_parse_1.jsParse((script.childNodes.length) ? script.childNodes[0].value : '');
            }
            catch (err) {
                // Figure out the correct line number for the error.
                var line = 0;
                var col = 0;
                if (script.__ownerDocument && script.__ownerDocument == href) {
                    line = script.__locationDetail.line - 1;
                    col = script.__locationDetail.column - 1;
                }
                line += err.lineNumber;
                col += err.column;
                var message = "Error parsing script in " + href + " at " + line + ":" + col;
                message += "\n" + err.stack;
                var fixedErr = (new Error(message));
                fixedErr.location = { line: line, column: col };
                fixedErr.ownerDocument = script.__ownerDocument;
                return Promise.reject(fixedErr);
            }
            if (parsedJs.elements) {
                parsedJs.elements.forEach((element) => {
                    element.scriptElement = script;
                    element.contentHref = href;
                    this.elements.push(element);
                    if (element.is in this.elementsByTagName) {
                        console.warn('Ignoring duplicate element definition: ' + element.is);
                    }
                    else {
                        this.elementsByTagName[element.is] = element;
                    }
                });
            }
            if (parsedJs.features) {
                parsedJs.features.forEach(function (feature) {
                    feature.contentHref = href;
                    feature.scriptElement = script;
                });
                this.features = this.features.concat(parsedJs.features);
            }
            if (parsedJs.behaviors) {
                parsedJs.behaviors.forEach((behavior) => {
                    behavior.contentHref = href;
                    this.behaviorsByName[behavior.is] = behavior;
                    this.behaviorsByName[behavior.symbol] = behavior;
                });
                this.behaviors = this.behaviors.concat(parsedJs.behaviors);
            }
            if (!Object.hasOwnProperty.call(this.parsedScripts, href)) {
                this.parsedScripts[href] = [];
            }
            var scriptElement;
            if (script.__ownerDocument && script.__ownerDocument == href) {
                scriptElement = script;
            }
            this.parsedScripts[href].push({
                ast: parsedJs.parsedScript,
                scriptElement: scriptElement
            });
            return Promise.resolve(parsedJs);
        }
        if (this.loader) {
            var resolvedSrc = url.resolve(href, src);
            return this.loader.request(resolvedSrc).then((content) => {
                this._content[resolvedSrc] = content;
                var scriptText = dom5.constructors.text(content);
                dom5.append(script, scriptText);
                dom5.removeAttribute(script, 'src');
                script.__hydrolysisInlined = src;
                return this._processScript(script, resolvedSrc);
            }).catch(function (err) { throw err; });
        }
        else {
            return Promise.resolve(EMPTY_METADATA);
        }
    }
    ;
    _dependenciesLoadedFor(href, root) {
        var found = {};
        if (root !== undefined) {
            found[root] = true;
        }
        return this._getDependencies(href, found).then((deps) => {
            var depPromises = deps.map((depHref) => {
                return this.load(depHref).then((htmlMonomer) => {
                    return htmlMonomer.metadataLoaded;
                });
            });
            return Promise.all(depPromises);
        });
    }
    ;
    /**
     * List all the html dependencies for the document at `href`.
     * @param  {string}                   href      The href to get dependencies for.
     * @param  {Object.<string,boolean>=} found     An object keyed by URL of the
     *     already resolved dependencies.
     * @param  {boolean=}                transitive Whether to load transitive
     *     dependencies. Defaults to true.
     * @return {Array.<string>}  A list of all the html dependencies.
     */
    _getDependencies(href, found, transitive) {
        if (found === undefined) {
            found = {};
            found[href] = true;
        }
        if (transitive === undefined) {
            transitive = true;
        }
        var deps = [];
        return this.load(href).then((htmlMonomer) => {
            var transitiveDeps = [];
            htmlMonomer.depHrefs.forEach((depHref) => {
                if (found[depHref]) {
                    return;
                }
                deps.push(depHref);
                found[depHref] = true;
                if (transitive) {
                    transitiveDeps.push(this._getDependencies(depHref, found));
                }
            });
            return Promise.all(transitiveDeps);
        }).then(function (transitiveDeps) {
            var alldeps = transitiveDeps.reduce(function (a, b) {
                return a.concat(b);
            }, []).concat(deps);
            return alldeps;
        });
    }
    ;
    /**
     * Returns the elements defined in the folder containing `href`.
     * @param {string} href path to search.
     */
    elementsForFolder(href) {
        return this.elements.filter(function (element) {
            return matchesDocumentFolder(element, href);
        });
    }
    ;
    /**
     * Returns the behaviors defined in the folder containing `href`.
     * @param {string} href path to search.
     * @return {Array.<BehaviorDescriptor>}
     */
    behaviorsForFolder(href) {
        return this.behaviors.filter(function (behavior) {
            return matchesDocumentFolder(behavior, href);
        });
    }
    ;
    /**
     * Returns a promise that resolves to a POJO representation of the import
     * tree, in a format that maintains the ordering of the HTML imports spec.
     * @param {string} href the import to get metadata for.
     * @return {Promise}
     */
    metadataTree(href) {
        return this.load(href).then((monomer) => {
            var loadedHrefs = {};
            loadedHrefs[href] = true;
            return this._metadataTree(monomer, loadedHrefs);
        });
    }
    ;
    _metadataTree(htmlMonomer, loadedHrefs) {
        return __awaiter(this, void 0, void 0, function* () {
            if (loadedHrefs === undefined) {
                loadedHrefs = {};
            }
            let metadata = yield htmlMonomer.metadataLoaded;
            metadata = {
                elements: metadata.elements,
                features: metadata.features,
                behaviors: [],
                href: htmlMonomer.href
            };
            const hrefs = yield htmlMonomer.depsLoaded;
            var depMetadata = [];
            for (const href of hrefs) {
                let metadataPromise;
                if (!loadedHrefs[href]) {
                    loadedHrefs[href] = true;
                    metadataPromise = this._metadataTree(this.html[href], loadedHrefs);
                    yield metadataPromise;
                }
                else {
                    metadataPromise = Promise.resolve({});
                }
                depMetadata.push(metadataPromise);
            }
            return Promise.all(depMetadata).then(function (importMetadata) {
                // TODO(ajo): remove this when tsc stops having issues.
                metadata.imports = importMetadata;
                return htmlMonomer.htmlLoaded.then(function (parsedHtml) {
                    metadata.html = parsedHtml;
                    if (metadata.elements) {
                        metadata.elements.forEach(function (element) {
                            attachDomModule(parsedHtml, element);
                        });
                    }
                    return metadata;
                });
            });
        });
    }
    ;
    _inlineStyles(ast, href) {
        var cssLinks = dom5.queryAll(ast, polymerExternalStyle);
        cssLinks.forEach((link) => {
            var linkHref = dom5.getAttribute(link, 'href');
            var uri = url.resolve(href, linkHref);
            var content = this._content[uri];
            var style = dom5.constructors.element('style');
            dom5.setTextContent(style, '\n' + content + '\n');
            dom5.replace(link, style);
        });
        return cssLinks.length > 0;
    }
    ;
    _inlineScripts(ast, href) {
        var scripts = dom5.queryAll(ast, externalScript);
        scripts.forEach((script) => {
            var scriptHref = dom5.getAttribute(script, 'src');
            var uri = url.resolve(href, scriptHref);
            var content = this._content[uri];
            var inlined = dom5.constructors.element('script');
            dom5.setTextContent(inlined, '\n' + content + '\n');
            dom5.replace(script, inlined);
        });
        return scripts.length > 0;
    }
    ;
    _inlineImports(ast, href, loaded) {
        var imports = dom5.queryAll(ast, isHtmlImportNode);
        imports.forEach((htmlImport) => {
            var importHref = dom5.getAttribute(htmlImport, 'href');
            var uri = url.resolve(href, importHref);
            if (loaded[uri]) {
                dom5.remove(htmlImport);
                return;
            }
            var content = this.getLoadedAst(uri, loaded);
            dom5.replace(htmlImport, content);
        });
        return imports.length > 0;
    }
    ;
    /**
     * Returns a promise resolving to a form of the AST with all links replaced
     * with the document they link to. .css and .script files become &lt;style&gt; and
     * &lt;script&gt;, respectively.
     *
     * The elements in the loaded document are unmodified from their original
     * documents.
     *
     * @param {string} href The document to load.
     * @param {Object.<string,boolean>=} loaded An object keyed by already loaded documents.
     * @return {Promise.<DocumentAST>}
     */
    getLoadedAst(href, loaded) {
        if (!loaded) {
            loaded = {};
        }
        loaded[href] = true;
        var parsedDocument = this.parsedDocuments[href];
        var analyzedDocument = this.html[href];
        var astCopy = dom5.parse(dom5.serialize(parsedDocument));
        // Whenever we inline something, reset inlined to true to know that anoather
        // inlining pass is needed;
        this._inlineStyles(astCopy, href);
        this._inlineScripts(astCopy, href);
        this._inlineImports(astCopy, href, loaded);
        return astCopy;
    }
    ;
    /**
     * Calls `dom5.nodeWalkAll` on each document that `Anayzler` has laoded.
     */
    nodeWalkDocuments(predicate) {
        var results = [];
        for (var href in this.parsedDocuments) {
            var newNodes = dom5.nodeWalkAll(this.parsedDocuments[href], predicate);
            results = results.concat(newNodes);
        }
        return results;
    }
    ;
    /**
     * Calls `dom5.nodeWalkAll` on each document that `Anayzler` has laoded.
     *
     * TODO: make nodeWalkAll & nodeWalkAllDocuments distict, or delete one.
     */
    nodeWalkAllDocuments(predicate) {
        var results = [];
        for (var href in this.parsedDocuments) {
            var newNodes = dom5.nodeWalkAll(this.parsedDocuments[href], predicate);
            results = results.concat(newNodes);
        }
        return results;
    }
    ;
    /** Annotates all loaded metadata with its documentation. */
    annotate() {
        if (this.features.length > 0) {
            var featureEl = docs.featureElement(this.features);
            this.elements.unshift(featureEl);
            this.elementsByTagName[featureEl.is] = featureEl;
        }
        var behaviorsByName = this.behaviorsByName;
        var elementHelper = (descriptor) => {
            docs.annotateElement(descriptor, behaviorsByName);
        };
        this.elements.forEach(elementHelper);
        this.behaviors.forEach(elementHelper); // Same shape.
        this.behaviors.forEach((behavior) => {
            if (behavior.is !== behavior.symbol && behavior.symbol) {
                this.behaviorsByName[behavior.symbol] = undefined;
            }
        });
    }
    ;
    /** Removes redundant properties from the collected descriptors. */
    clean() {
        this.elements.forEach(docs.cleanElement);
    }
    ;
}
/**
 * Shorthand for transitively loading and processing all imports beginning at
 * `href`.
 *
 * In order to properly filter paths, `href` _must_ be an absolute URI.
 *
 * @param {string} href The root import to begin loading from.
 * @param {LoadOptions=} options Any additional options for the load.
 * @return {Promise<Analyzer>} A promise that will resolve once `href` and its
 *     dependencies have been loaded and analyzed.
 */
Analyzer.analyze = function analyze(href, options) {
    options = options || {};
    options.filter = options.filter || _defaultFilter(href);
    var loader = new file_loader_1.FileLoader();
    var resolver = options.resolver;
    if (resolver === undefined) {
        if (typeof window === 'undefined') {
            resolver = 'fs';
        }
        else {
            resolver = 'xhr';
        }
    }
    let primaryResolver;
    if (resolver === 'fs') {
        primaryResolver = new fs_resolver_1.FSResolver(options);
    }
    else if (resolver === 'xhr') {
        primaryResolver = new xhr_resolver_1.XHRResolver(options);
    }
    else if (resolver === 'permissive') {
        primaryResolver = new error_swallowing_fs_resolver_1.ErrorSwallowingFSResolver(options);
    }
    else {
        throw new Error("Resolver must be one of 'fs', 'xhr', or 'permissive'");
    }
    loader.addResolver(primaryResolver);
    if (options.content) {
        loader.addResolver(new string_resolver_1.StringResolver({ url: href, content: options.content }));
    }
    loader.addResolver(new noop_resolver_1.NoopResolver({ test: options.filter }));
    var analyzer = new Analyzer(false, loader);
    return analyzer.metadataTree(href).then((root) => {
        if (!options.noAnnotations) {
            analyzer.annotate();
        }
        if (options.clean) {
            analyzer.clean();
        }
        return Promise.resolve(analyzer);
    });
};
exports.Analyzer = Analyzer;
;
/**
 * @private
 * @param {string} href
 * @return {function(string): boolean}
 */
function _defaultFilter(href) {
    // Everything up to the last `/` or `\`.
    var base = href.match(/^(.*?)[^\/\\]*$/)[1];
    return function (uri) {
        return uri.indexOf(base) !== 0;
    };
}
function matchesDocumentFolder(descriptor, href) {
    if (!descriptor.contentHref) {
        return false;
    }
    var descriptorDoc = url.parse(descriptor.contentHref);
    if (!descriptorDoc || !descriptorDoc.pathname) {
        return false;
    }
    var searchDoc = url.parse(href);
    if (!searchDoc || !searchDoc.pathname) {
        return false;
    }
    var searchPath = searchDoc.pathname;
    var lastSlash = searchPath.lastIndexOf("/");
    if (lastSlash > 0) {
        searchPath = searchPath.slice(0, lastSlash);
    }
    return descriptorDoc.pathname.indexOf(searchPath) === 0;
}
// TODO(ajo): Refactor out of vulcanize into dom5.
var polymerExternalStyle = dom5.predicates.AND(dom5.predicates.hasTagName('link'), dom5.predicates.hasAttrValue('rel', 'import'), dom5.predicates.hasAttrValue('type', 'css'));
var externalScript = dom5.predicates.AND(dom5.predicates.hasTagName('script'), dom5.predicates.hasAttr('src'));
var isHtmlImportNode = dom5.predicates.AND(dom5.predicates.hasTagName('link'), dom5.predicates.hasAttrValue('rel', 'import'), dom5.predicates.NOT(dom5.predicates.hasAttrValue('type', 'css')));
function attachDomModule(parsedImport, element) {
    var domModules = parsedImport['dom-module'];
    for (const domModule of domModules) {
        if (dom5.getAttribute(domModule, 'id') === element.is) {
            element.domModule = domModule;
            return;
        }
    }
}
