/**
 * Created by james on 8/7/14.
 */

/*global describe, setTimeout, it, beforeEach, spyOn, expect */

"use strict";

var requ = require('../index');
var _ = require('underscore');
var bunsenLib = require('bunsen/libraries/bunsen');

var Request = requ.Request;

var fakeResponseBody = { foo: 1 };
var fakeResponseObj = {
    body: fakeResponseBody,
    xhr: {
        statusText: 'OK',
        statusCode: 200,
        status: 200,
        responseJSON: fakeResponseBody,
        responseText: JSON.stringify(fakeResponseBody)
    },
    status: 200
};
var lastSARequestObject;
var mockShouldSucceed = true;
var mockErrorObject = null;
var mockErrorResponseBody = {status: 500, message: 'Some error'};
var mockOnMethod;
var mockErrorResponse = {
    body: mockErrorResponseBody,
    xhr: {
        statusText: 'OK',
        statusCode: 500,
        status: 500,
        responseJSON: mockErrorResponseBody,
        responseText: JSON.stringify(mockErrorResponseBody)
    },
    status: 500
};

var mockSARequest = function (method, url) {
    var methods = ['send', 'query', 'post', 'get', 'put', 'delete', 'set', 'abort'];
    // todo fix lint error
    var req = lastSARequestObject = {}; //jshint ignore:line
    var returnReqFn = function () {
        return req;
    };
    _.each(methods, function (method) {
        req[method] = returnReqFn;
        spyOn(req, method).and.callThrough();
    });
    req.method = method;
    req.url = url;
    req.isMockSARequest = true;
    req.end = function (callback) {
        setTimeout(function () {
            if (mockShouldSucceed) {
                callback(null, fakeResponseObj);
            } else {
                callback(mockErrorObject, mockErrorResponse);
            }
        }, 5);
    };
    req.on = mockOnMethod;
    req[method](url);
    return req;
};

describe('requ', function () {
    var options;
    beforeEach(function () {
        options = {
            dataType: 'json',
            url: 'my/url',
            type: 'get'
        };
        spyOn(Request.prototype, '_makeSARequestInstance').and.callFake(function (method, url) {
            return mockSARequest(method, url);
        });
        spyOn(Request, '_jQueryAjax');
        mockOnMethod = jasmine.createSpy();
        Request._isBrowser = true;
    });
    describe('with browser environment and deferring to jQuery.ajax', function () {
        it('should invoke $.ajax with the passed options', function () {
            requ(options);
            expect(Request._jQueryAjax).toHaveBeenCalled();
            var args = Request._jQueryAjax.calls.mostRecent().args;
            expect(args[0].url).toBe(options.url);
            expect(args[0].type).toBe(options.type);
            expect(args[0].dataType).toBe(options.dataType);
        });
    });
    describe('with browser environment and deferring to superagent', function () {
        beforeEach(function () {
            requ.useJQueryIfBrowser = false;
        });
        afterEach(function() {
            requ.useJQueryIfBrowser = true;
        });
        it('should invoke send with the "data" options from the ajax configuration for put and post requests', function () {
            var data = { bar: 1 };
            options.type = 'post';
            options.data = data;
            options.contentType = 'application/json';
            requ(options);
            expect(lastSARequestObject.post).toHaveBeenCalled();
            expect(lastSARequestObject.post.calls.mostRecent().args[0]).toEqual(options.url);
            expect(lastSARequestObject.send).toHaveBeenCalled();
            expect(lastSARequestObject.send.calls.mostRecent().args[0]).toEqual(data);
        });
        describe('Success handling', function () {
            it('should return a promise, and done should pass the fake response, textStatus, and fakeXhr. The fake xhr should have a superagentResponse property.', function (done) {
                var prom = requ(options);
                expect(Request.prototype._makeSARequestInstance).toHaveBeenCalled();
                expect(typeof prom.promise === 'function').toBe(true);
                prom.done(function (response, textStatus, jqXhr) {
                    expect(response).toEqual(fakeResponseBody);
                    expect(textStatus).toBe('success');
                    expect(_.isFunction(jqXhr.promise)).toBe(true);
                    expect(typeof jqXhr.superagentResponse).toBe('object');
                    done();
                });
            });
            it('should have the settings for the "ajax" call as the context by default, with the url, type, dataType, etc.', function (done) {
                var contentType = 'application/json';
                var data = { baz: 4 };
                options.data = data;
                options.contentType = contentType;
                var prom = requ(options);
                expect(Request.prototype._makeSARequestInstance).toHaveBeenCalled();
                prom.done(function () {
                    expect(this).toBeDefined();
                    expect(this.url).toBe(bunsenLib.extendURL(options.url, data));
                    expect(this.dataType).toBe(options.dataType);
                    expect(this.type).toBe(options.type.toUpperCase());
                    done();
                });
            });
            it('should have the context option as the context in the callback, if provided', function (done) {
                var context = options.context = { name: 'whoopsie-daisy' };
                options.success = function () {
                    expect(this).toBeDefined();
                    expect(this).toBe(context);
                    done();
                };
                requ(options);
            });
        });
        describe('Error handling', function () {
            it('should invoke the fail callback with the xhr and text status as the params and the settings as "this"', function (done) {
                mockShouldSucceed = false;
                options.data = {foo: 'weeeee'};
                requ(options).fail(function (jqXhr, text) {
                    expect(this.type).toBe(options.type.toUpperCase());
                    expect(this.url).toBe(bunsenLib.extendURL(options.url, options.data));
                    expect(this.dataType).toBe('json');
                    expect(text).toBe('error');
                    expect(typeof jqXhr.responseText).toBe('string');
                    done();
                });
            });
        });
        describe('setSAEventListener', function () {
            it('should bind an event handler to every superagent request that gets made', function () {
                var callbackA = function () {};
                var callbackB = jasmine.createSpy();
                requ.setSAEventListener('request', callbackA);
                requ.setSAEventListener('end', callbackB);
                requ(options);
                expect(mockOnMethod).toHaveBeenCalled();
                expect(mockOnMethod.calls.count()).toBe(2);
                expect(mockOnMethod.calls.mostRecent().args[0]).toBe('end');
                expect(typeof mockOnMethod.calls.mostRecent().args[1]).toBe('function');
                mockOnMethod.calls.mostRecent().args[1]();
                expect(callbackB).toHaveBeenCalled();
                expect(callbackB.calls.count()).toBe(1);
                requ(options);
                expect(mockOnMethod.calls.count()).toBe(4);
            });
        });
        describe('getSARequest method', function () {
            it('should return an request object created by superagent', function () {
                var req = new requ.Request();
                req.send(options);
                expect(req.getSARequest().isMockSARequest).toBe(true);
            });
        });
        describe('getSARequestFullURL', function () {
            it('should return the url, with query params if method is GET', function () {
                var req = new requ.Request();
                req.send(options);
                expect(req.getSARequestFullURL()).toBe(options.url);
                req = new requ.Request();
                options.data = {foo: 'bar'};
                req.send(options);
                expect(req.getSARequestFullURL()).toBe(bunsenLib.extendURL(options.url, {foo: 'bar'}));
                req = new requ.Request();
                options.type = 'post';
                options.contentType = 'application/json';
                req.send(options);
                expect(req.getSARequestFullURL()).toBe(options.url);
            });
        });
        describe('getSARequestPayload', function () {
            it('should return a payload if the request has one', function () {
                var req = new requ.Request();
                req.send(options);
                expect(req.getSARequestPayload()).toBe(null);
                options.data = {foo: 'bar'};
                req = new requ.Request();
                req.send(options);
                expect(req.getSARequestPayload()).toBe(null);
                options.type = 'put';
                options.contentType = 'application/json';
                req = new requ.Request();
                req.send(options);
                expect(req.getSARequestPayload()).toEqual({foo: 'bar'});
            });
        });
    });
});
