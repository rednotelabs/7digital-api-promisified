'use strict';

var xml2js = require('xml2js');
var _ = require('lodash');
var ApiParseError = require('./errors').ApiParseError;
var ApiError = require('./errors').ApiError;
var OAuthError = require('./errors').OAuthError;
var cleaners = require('./response-cleaners');

// Callback for parsing the XML response return from the API
// and converting it to JSON and handing control back to the
// caller.
//
// - @param {Function} callback - the caller's callback
// - @param {String} response - the XML response from the API
// - @parma {Object} opts - an options hash with the desired format and logger
function parse(response, opts, callback) {
	var parser, jsonParseError, result;

	if (opts.format.toUpperCase() === 'XML') {
		callback(null, response);
		return;
	}

	if (opts.contentType && opts.contentType.indexOf('json') >= 0) {
		try {
			result = JSON.parse(response);
		} catch (e) {
			jsonParseError = e;
		}
		return validateAndCleanResponse(jsonParseError, { response: result });
	}

	parser = new xml2js.Parser({
		mergeAttrs: true,
		explicitArray: false
	});

	parser.parseString(response, validateAndCleanResponse);
	function validateAndCleanResponse(err, result) {
		var cleanedResult;
		var clean, error, apiError;

		function makeParseErr(msg) {
			return new ApiParseError(msg + ' from: ' + opts.url, response);
		}

		// Unparsable response text
		if (err) {
			return callback(makeParseErr('Unparsable api response'));
		}
		if (!result) {
			return callback(makeParseErr('Empty response'));
		}
		if (!result.response) {
			return callback(makeParseErr('Missing response node'));
		}

		// If JSON response is requested, API sometimes doesn't return status for some reason. We add it by ourselves so that
		// the rest of the procesessing doesn't break
		if (!result.response.status) {
			result.response.status = result.response.error ? 'error' : 'ok';
		}

		// Reponse was a 7digital API error object
		if (result.response.status === 'error') {
			error = result.response.error;
			if (/oauth/i.test(error.errorMessage || error.message)) {
				return callback(new OAuthError(error,
					(error.errorMessage || error.message) + ': ' + opts.url));
			}

			apiError = new ApiError(error, (error.errorMessage || error.message) + ': '
				+ opts.url);
			apiError.params = opts.params;

			return callback(apiError);
		} else if (result.response.status !== 'ok') {
			return callback(new ApiParseError(
				'Unexpected response status from: ' + opts.url, response));
		}

		const funcs = [
			cleaners.renameCardTypes,
			...(_.get(opts, 'fullOptions.ensureCollections', true) ? [cleaners.ensureCollections.bind(null, cleaners.collectionPaths)] : []),
			cleaners.removeXmlNamespaceKeys,
			cleaners.nullifyNils,
		];

		clean = _.flowRight(funcs);

		cleanedResult = clean(result.response);
		return callback(null, cleanedResult);
	}
}

module.exports.parse = parse;
