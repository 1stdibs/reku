/*jslint node:true, vars:true */
/**
 * requ.js v0.0.0
 */

"use strict";

console.assert(typeof module !== "undefined", 'Node JS or CommonJS environment required');

var isBrowser = (typeof window !== "undefined");

// ---------------------------------------------------
// Dependencies

var superagent = require('superagent');
var _ = require('underscore');
var Qs = require('qs');
var Deferred = require('simply-deferred').Deferred;

//Add URL params to backbone model or backbone collection URL
var extendURL = function(url, data) {
    var urlArray = url.split('?');
    var queries;

    queries = urlArray[1] ? Qs.parse(urlArray[1]) : {};
    _.extend(queries, data);
    return urlArray[0] + '?' + Qs.stringify(queries);
};


// ---------------------------------------------------
// Local vars

// will use $.ajax if jquery is defined globally
var jQueryAjax = (typeof $ !== "undefined") ? $.ajax : null;

var methodsMap = {
    'GET': 'get',
    'POST': 'post',
    'PUT': 'put',
    'DELETE': 'del',
    'PATCH': 'patch',
    'HEAD': 'head'
};

var dataTypeAcceptsMap = {
    html: 'text/html',
    xml: 'text/xml',
    text: 'text/plain',
    json: 'application/json'
};

var methodsWithBody = ['POST', 'PUT', 'PATCH'];

// ---------------------------------------------------
// Module Definition

/**
 * @module requ
 * @param {object} options A jQuery.ajax style options object
 * @returns {requ.Request}
 */
var requ = module.exports = function (options) {
    return new requ.Request().send(options);
};

/**
 * @memberOf module:requ
 * @type {boolean}
 */
requ.useJQueryIfBrowser = true;

/**
 * Replace jQuery.ajax with requ, if you want to
 * force existing modules using it to use requ
 * instead.
 * @memberOf module:requ
 * @param  {boolean} shouldReplace
 *     Pass true to replace $.ajax with calls
 *     with requ, and pass false to restore it
 * @returns {function} requ module function
 */
requ.replaceJQueryAjax = function (shouldReplace) {
    console.assert(!!$ && !!$.ajax, 'jQuery is required in order to replace jQuery.ajax');
    if (shouldReplace) {
        $.ajax = requ;
    } else {
        $.ajax = jQueryAjax;
    }
    return requ;
};

/**
 * Set a static callback function that
 * will be invoked before any request
 * is made with requ
 * @memberOf module:requ
 * @param {Function} callback
 */
requ.setBeforeRequestCallback = function (callback) {
    requ.Request._onBeforeRequest = callback;
};

/**
 * Set a static callback function that
 * is invoked at the end of every
 * superagent request made with requ.
 * @param callback
 */
requ.setAfterSARequestCallback = function (callback) {
    requ.Request._onAfterSARequest = callback;
};

/**
 * Set a static callback function that is
 * invoked when a superagent request is
 * sent.
 * @memberOf module:requ
 * @param {function} callback
 */
requ.setOnSARequestSentEvent = function (callback) {
    requ.setSAEventListener('request', callback);
};

/**
 * Set a static callback function that
 * is invoked when the headers for a response
 * are received but the body of the response
 * hasn't been downloaded yet.
 * @memberOf module:requ
 * @param {function} callback
 */
requ.setOnSAResponseEvent = function (callback) {
    requ.setSAEventListener('response', callback);
};

/**
 * Set a callback that will be invoked every time
 * a superagent instance emits that event
 * @memberOf module:requ
 * @param {string} event
 * @param {function} callback
 */
requ.setSAEventListener = function (event, callback) {
    requ.Request._saEventListeners[event] = callback;
};

/**
 * @class Request
 * @memberOf module:requ
 */
var Request = requ.Request = function () {};

/**
 * @memberOf module:requ.Request
 * @type {boolean}
 * @protected
 */
Request._isBrowser = isBrowser;

/**
 * @memberOf module:requ.Request
 * @type {function}
 * @protected
 */
Request._jQueryAjax = jQueryAjax;

/**
 * @memberOf module:requ.Request
 * @type {object}
 * @protected
 */
Request._dataTypeAcceptsMap = dataTypeAcceptsMap;

/**
 * @memberOf module:requ.Request
 * @type {string[]}
 * @protected
 */
Request._allowedOptions = [
    'url', 'type', 'dataType', 'contentType', 'data', 'success', 'error', 'complete', 'headers', 'context'
];

/**
 * @memberOf module:requ.Request
 * @type {object}
 * @private
 */
Request._saEventListeners = {};

/**
 * @private
 * @type {string[]}
 * @memberOf module:requ.Request
 */
Request._jQueryAjaxOptions = [
    'accepts', 'async', 'beforeSend', 'cache', 'complete', 'contents', 'contentType', 'context', 'converters', 'crossDomain', 'data', 'dataFilter', 'dataType', 'error', 'global', 'headers', 'ifModified', 'isLocal', 'jsonp', 'jsonpCallback', 'mimeType', 'password', 'processData', 'scriptCharset', 'statusCode', 'success', 'timeout', 'traditional', 'type', 'url', 'username', 'xhr', 'xhrFields'
];

/**
 * @memberOf module:requ.Request
 * @protected
 */
Request._statusKeyVals = [
    { status: 200, statusText: 'OK' },
    { status: 201, statusText: 'Created' },
    { status: 202, statusText: 'Accepted' },
    { status: 204, statusText: 'No Content' },
    { status: 301, statusText: 'Moved Permanently' },
    { status: 302, statusText: 'Found' },
    { status: 400, statusText: 'Bad Request' },
    { status: 401, statusText: 'Unauthorized' },
    { status: 403, statusText: 'Forbidden' },
    { status: 404, statusText: 'Not Found' },
    { status: 405, statusText: 'Method Not Allowed' },
    { status: 408, statusText: 'Request Timeout' },
    { status: 412, statusText: 'Precondition Failed' },
    { status: 500, statusText: 'Internal Server Error' },
    { status: 502, statusText: 'Bad Gateway' },
    { status: 503, statusText: 'Service Unavailable' },
    { status: 504, statusText: 'Gateway Timeout' }
];

/**
 * @memberOf module:requ.Request
 * @protected
 */
Request._defaultSettings = {
    async: true,
    accepts: {
        "*": "*/*",
        html: "text/html",
        json: "application/json, text/javascript",
        script: "text/javascript, application/javascript, application/ecmascript, application/x-ecmascript",
        text: "text/plain",
        xml: "application/xml, text/xml"
    },
    type: 'GET',
    global: false,
    crossDomain: false,
    processData: true
};

/**
 * @lends module:requ.Request.prototype
 */
Request.prototype = {

    /**
     * @param {object} options A jQuery.ajax style options object
     * @return {Promise}
     */
    send: function (options) {
        this._testAllowedOptions(options); // Warn user if unsupported options are used
        if (Request._isBrowser && requ.useJQueryIfBrowser) {
            console.assert(Request._jQueryAjax, 'jQuery is required if "requ.useJQueryIfBrowser" is true');
            options = this._settings = this._invokeBeforeRequestCallback(options);
            return Request._jQueryAjax(options);
        }
        return this.sendUsingSuperAgent(options);
    },

    /**
     * @param {object} options A jQuery.ajax style options object
     * @return {Promise}
     */
    sendUsingSuperAgent: function (options) {

        if (this._requXhr) {
            console.error('Request on requ.Request instance already in progress');
            return null;
        }

        options = this._invokeBeforeRequestCallback(options);

        options = this._settings = this._formatSettings(options);

        var self = this;
        var method = options.type;
        var url = options.url;
        var data = options.data;
        var dataType = options.dataType;
        var contentType = options.contentType;
        var dfd = self._deferred = self._makeDeferred();
        var requXhr = self._requXhr = dfd.promise();
        var request;

        var methodFn;

        self._context = options.context || self._settings;

        requXhr.readyState = 0;

        method = method.toUpperCase();
        methodFn = methodsMap[method];

        console.assert(methodFn, 'options.type "' + methodsMap[method] + '" not supported');
        console.assert(typeof url === 'string', 'options.url is required');
        console.assert(superagent[methodFn], 'superagent version does not support method "' + method + '"');

        self._request = request = self._makeSARequestInstance(methodFn, url);

        self._bindEventListeners(request);

        console.assert(!data || (data && contentType) || (data && !self._useRequestBodyForMethod(method)), 'options.contentType is required if options.data is provided for PUT/POST');
        console.assert(typeof dataType === 'string', 'options.dataType is required');
        console.assert(dataTypeAcceptsMap[dataType], 'options.dataType value "' + dataType + '" is not supported');

        if (data && !_.isEmpty(data)) {
            if (self._useRequestBodyForMethod(method)) {
                request = request.send(data); // add body for methods that have a body
            } else {
                options.url = extendURL(options.url, data); // so that success callbacks can access the url you would with jquery
                request = request.query(data); // add query params for methods that don't have a body
            }
        }

        if (contentType) {
            request = request.set('Content-Type', contentType);
        }

        if (dataType) {
            request = request.set('Accepts', dataTypeAcceptsMap[dataType]);
        }

        // Set 'Content-Length' to 0 because 'Transfer-Encoding' is set to 'chunked' by default on Node apps and DELETEs 503
        // TODO : Remove when Node is upgraded (fixed as of Node v0.11)
        if (method === 'DELETE') {
            options.headers = options.headers || {};
            options.headers['Content-Length'] = 0;
        }

        if (options.headers) {
            request = self._setHeaders(request, options.headers);
        }

        if (!request) {
            return null;
        }

        request.end(_.bind(self._onSARequestEnd, self));

        requXhr.abort = _.bind(request.abort, request);

        self._attachCallbacks(dfd, options);

        return requXhr;
    },

    /**
     * Return the settings used for the request
     * (e.g. url, method, etc.)
     * @returns {object}
     */
    getRequestSettings: function () {
        return this._settings;
    },

    /**
     * @returns {superagent.Request}
     */
    getSARequest: function () {
        return this._request;
    },

    /**
     * Return the request url with the query string
     * @returns {string}
     */
    getSARequestFullURL: function () {
        var request = this._request;
        var settings;
        var url;
        if (request && request.url) {
            settings = this._settings;
            url = request.url;
            if (settings && settings.data && !this._useRequestBodyForMethod(settings.type)) {
                url = extendURL(url, settings.data);
            }
            return url;
        }
        return null;
    },

    /**
     * @returns {string}
     */
    getSARequestMethod: function () {
        var request = this._request;
        return request ? request.method : null;
    },

    /**
     * @returns {object}
     */
    getSARequestPayload: function () {
        var settings = this._settings;
        if (settings && this._useRequestBodyForMethod(settings.type) && settings.data) {
            return settings.data;
        }
        return null;
    },

    _invokeBeforeRequestCallback: function (options) {
        if (typeof Request._onBeforeRequest === 'function') {
            options = Request._onBeforeRequest.call(this, options) || options;
        }
        return options;
    },

    _invokeAfterSARequestCallback: function (err, response) {
        if (typeof Request._onAfterSARequest === 'function') {
            Request._onAfterSARequest.call(this, err, response);
        }
    },

    /**
     * @param {string} method
     * @returns {boolean}
     * @protected
     */
    _useRequestBodyForMethod: function (method) {
        return _.indexOf(methodsWithBody, method) > -1;
    },

    /**
     * @returns {Deferred}
     * @protected
     */
    _makeDeferred: function () {
        return new Deferred();
    },

    /**
     * @param res
     * @returns {object}
     * @protected
     */
    _getXhrPropertiesFromRes: function (res) {
        var contentType;
        var statusInfo = this._findStatusInfo(res.statusCode);
        var props = {
            status: res.statusCode,
            statusCode: res.statusCode,
            statusText: (statusInfo ? statusInfo.statusText : ''),
            responseText: res.text,
            response: res.text
        };
        if (res.body && res.headers && res.headers['content-type']) {
            contentType = res.headers['content-type'] || '';
            if (contentType.indexOf('application/json') > -1) {
                props.responseJSON = res.body;
            } else if (contentType.indexOf('application/xml') > -1 || contentType.indexOf('text/xml') > -1) {
                props.responseXML = res.body;
            }
        }
        return props;
    },

    /**
     * Handles request end event for superagent.Request instances
     * @param  {Error} err
     * @param  {superagent.Response} response
     * @protected
     */
    _onSARequestEnd: function (err, response) {

        this._invokeAfterSARequestCallback(err, response);

        var self = this;
        var dfd = self._deferred;
        var requXhr = self._requXhr;
        var context = self._context;
        var xhr = (response && response.xhr) ? response.xhr : null;

        if (!xhr && response && response.res) {
            _.extend(requXhr, self._getXhrPropertiesFromRes(response.res));
        } else if (xhr) {
            _.extend(requXhr, self._getXhrPropertiesFromXhr(xhr));
        }

        requXhr.readyState = 4;
        requXhr.superagentResponse = response;

        if (err) {
            requXhr.superagentError = err;
            dfd.rejectWith(context, [requXhr, 'error', err]);
            self._requXhr = null;
            return;
        }
        if (self._resStatusIsError(requXhr.statusCode)) {
            dfd.rejectWith(context, [requXhr, 'error']);
            self._requXhr = null;
            return;
        }
        dfd.resolveWith(context, [response.body, 'success', requXhr]);
        self._requXhr = null;
    },

    /**
     * Ensure that the request options are similar
     * to the settings object that jquery uses as the
     * context for it's callbacks
     * @param ajaxOptions
     * @private
     */
    _formatSettings: function (ajaxOptions) {
        ajaxOptions = _.extend({}, Request._defaultSettings, ajaxOptions);
        ajaxOptions.type = ajaxOptions.type.toUpperCase();
        return ajaxOptions;
    },

    /**
     * @param {number} status
     * @returns {object}
     * @protected
     */
    _findStatusInfo: function (status) {
        var i = 0;
        var keyVals = Request._statusKeyVals;
        var len = keyVals.length;
        for (i; i < len; i++) {
            if (keyVals[i].status === status) {
                return keyVals[i];
            }
        }
        return null;
    },

    /**
     * @param {number} status
     * @returns {boolean}
     * @protected
     */
    _resStatusIsError: function (status) {
        var strStatus = String(status);
        var firstNum = Number(strStatus.charAt(0));
        return (firstNum !== 2 && firstNum !== 3);
    },

    /**
     * @param {XMLHttpRequest} xhr
     * @returns {object}
     * @protected
     */
    _getXhrPropertiesFromXhr: function (xhr) {
        return _.pick(xhr, 'status', 'statusCode', 'statusText', 'response', 'responseText', 'responseJSON', 'responseXML');
    },

    /**
     * @param {Promise} promise
     * @param {object} options jQuery ajax options
     * @protected
     */
    _attachCallbacks: function (promise, options) {
        var onDone = options.success || options.done;
        var onFail = options.error || options.fail;
        var onComplete = options.complete || options.always;
        if (onDone) {
            promise.done(onDone);
        }
        if (onFail) {
            promise.fail(onFail);
        }
        if (onComplete) {
            promise.always(onComplete);
        }
    },

    /**
     * @param {string} method
     * @param {string} url
     * @returns {superagent.Request}
     * @protected
     */
    _makeSARequestInstance: function (method, url) {
        return superagent[method](url);
    },

    /**
     * @param {superagent.Request} request
     * @param {object} headers
     * @returns {superagent.Request}
     * @protected
     */
    _setHeaders: function (request, headers) {
        _.each(headers, function (headerVal, headerKey) {
            request = request.set(headerKey, headerVal);
        });
        return request;
    },

    /**
     * Shows warnings if the user passes an option that
     * is supported by $.ajax but not by requ.
     * @param {object} options [jQuery ajax options]{@link http://api.jquery.com/jquery.ajax/}
     * @returns {boolean}
     * @protected
     */
    _testAllowedOptions: function (options) {
        var key;
        var hasError = false;
        for (key in options) {
            if (options.hasOwnProperty(key)) {
                if (_.indexOf(Request._allowedOptions, key) === -1 &&
                    _.indexOf(Request._jQueryAjaxOptions, key) > -1) {
                    console.warn('Options "' + key + '" is not supported by requ');
                    hasError = true;
                }
            }
        }
        return !hasError;
    },

    /**
     * @param {superagent.Request} request
     * @protected
     */
    _bindEventListeners: function (request) {
        var events = Request._saEventListeners;
        _.each(events, function (callback, event) {
            request.on(event, _.bind(callback, this));
        }, this);
    }

};

