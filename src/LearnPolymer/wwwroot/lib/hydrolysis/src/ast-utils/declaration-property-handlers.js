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
const astValue = require('./ast-value');
const analyze_properties_1 = require('./analyze-properties');
/**
 * Returns an object containing functions that will annotate `declaration` with
 * the polymer-specificmeaning of the value nodes for the named properties.
 *
 * @param  {ElementDescriptor} declaration The descriptor to annotate.
 * @return {object.<string,function>}      An object containing property
 *                                         handlers.
 */
function declarationPropertyHandlers(declaration) {
    return {
        is: function (node) {
            if (node.type == 'Literal') {
                declaration.is = node.value.toString();
            }
        },
        properties: function (node) {
            var props = analyze_properties_1.analyzeProperties(node);
            for (var i = 0; i < props.length; i++) {
                declaration.properties.push(props[i]);
            }
        },
        behaviors: function (node) {
            if (node.type != 'ArrayExpression') {
                return;
            }
            const arrNode = node;
            for (const element of arrNode.elements) {
                let v = astValue.expressionToValue(element);
                if (v === undefined) {
                    v = astValue.CANT_CONVERT;
                }
                declaration.behaviors.push(v);
            }
        },
        observers: function (node) {
            if (node.type != 'ArrayExpression') {
                return;
            }
            const arrNode = node;
            for (let element of arrNode.elements) {
                var v = astValue.expressionToValue(element);
                if (v === undefined)
                    v = astValue.CANT_CONVERT;
                declaration.observers.push({
                    javascriptNode: element,
                    expression: v
                });
            }
        }
    };
}
exports.declarationPropertyHandlers = declarationPropertyHandlers;
