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
/**
 * A resolver that resolves to `config.content` any uri matching config.
 */
class StringResolver {
    constructor(config) {
        this.url = config.url;
        this.content = config.content;
        if (!this.url || !this.content) {
            throw new Error("Must provide a url and content to the string resolver.");
        }
    }
    /**
     * @param {string}    uri      The absolute URI being requested.
     * @param {!Deferred} deferred The deferred promise that should be resolved if
     *     this resolver handles the URI.
     * @return {boolean} Whether the URI is handled by this resolver.
     */
    accept(uri, deferred) {
        const url = this.url;
        if (url instanceof RegExp) {
            if (!url.test(uri)) {
                return false;
            }
        }
        else {
            if (uri.indexOf(url) == -1) {
                return false;
            }
        }
        deferred.resolve(this.content);
        return true;
    }
}
exports.StringResolver = StringResolver;
;
