'use strict';

var assert = require('chai').assert;
var parser = require('../lib/responseparser');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var ApiParseError = require('../lib/errors').ApiParseError;
var ApiError = require('../lib/errors').ApiError;

describe('responseparser', function() {

	function createOptsWithFormat(format) {
		return {
			format: format,
			contentType: 'application/xml',
			logger: { silly: function () {} }
		};
	}

	it('returns xml when format is xml', function() {
		var callbackSpy = sinon.spy();
		var xml = fs.readFileSync(path.join(__dirname +
				'/responses/release-tracks-singletrack.xml'), 'utf8');
		parser.parse(xml, createOptsWithFormat('XML'), callbackSpy);
		assert(callbackSpy.calledOnce);
		assert(callbackSpy.calledWith(null, xml));
	});

	it('returns javascript object when format is not xml', function() {
		var callbackSpy = sinon.spy();
		var xml = fs.readFileSync(path.join(__dirname +
			'/responses/release-tracks-singletrack.xml'), 'utf8');

		parser.parse(xml, createOptsWithFormat('js'), callbackSpy);
		assert(callbackSpy.calledOnce);
		assert.equal(typeof callbackSpy.lastCall.args[1], 'object');
	});

	it('returns parse error when response format is unexpected', function () {
		var callbackSpy = sinon.spy();
		var xml = 'some really rubbish xml';

		parser.parse(xml, createOptsWithFormat('js'), callbackSpy);
		assert(callbackSpy.calledOnce);
		assert.instanceOf(callbackSpy.lastCall.args[0], ApiParseError);
	});

	it('calls back with the error when the status is error', function () {
		var error, response, callbackSpy = sinon.spy();
		var xml = fs.readFileSync(
				path.join(__dirname, 'responses', 'release-not-found.xml'),
				'utf-8');

		parser.parse(xml, createOptsWithFormat('js'), callbackSpy);
		assert(callbackSpy.calledOnce);
		error = callbackSpy.lastCall.args[0];
		response = callbackSpy.lastCall.args[1];
		assert(error);
		assert.isUndefined(response);
		assert.instanceOf(error, ApiError);
		assert.equal(error.code, '2001');
		assert.equal(error.message, 'Release not found');
	});

});