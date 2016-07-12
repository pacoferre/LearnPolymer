/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
/**
* Finds and annotates the Polymer() and modulate() calls in javascript.
*/
'use strict';
const espree = require('espree');
const estraverse = require('estraverse');
const behavior_finder_1 = require('./behavior-finder');
const element_finder_1 = require('./element-finder');
const feature_finder_1 = require('./feature-finder');
function traverse(visitorRegistries) {
    function applyVisitors(name, node, parent) {
        for (const registry of visitorRegistries) {
            if (name in registry) {
                let returnVal = registry[name](node, parent);
                if (returnVal) {
                    return returnVal;
                }
            }
        }
    }
    return {
        enter: function (node, parent) {
            return applyVisitors('enter' + node.type, node, parent);
        },
        leave: function (node, parent) {
            return applyVisitors('leave' + node.type, node, parent);
        },
        fallback: 'iteration',
    };
}
function jsParse(jsString) {
    var script = espree.parse(jsString, {
        attachComment: true,
        comment: true,
        loc: true,
        ecmaVersion: 6
    });
    var featureInfo = feature_finder_1.featureFinder();
    var behaviorInfo = behavior_finder_1.behaviorFinder();
    var elementInfo = element_finder_1.elementFinder();
    var visitors = [featureInfo, behaviorInfo, elementInfo].map(function (info) {
        return info.visitors;
    });
    estraverse.traverse(script, traverse(visitors));
    return {
        behaviors: behaviorInfo.behaviors,
        elements: elementInfo.elements,
        features: featureInfo.features,
        parsedScript: script
    };
}
exports.jsParse = jsParse;
;
