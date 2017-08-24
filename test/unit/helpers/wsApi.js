'use strict';

var config = require('../../../config.json');

var async = require('async');
var chai = require('chai');
var expect = require('chai').expect;
var express = require('express');
var randomstring = require('randomstring');
var sinon = require('sinon');

var wsApi = require('../../../helpers/wsApi');
var failureCodes = require('../../../api/ws/rpc/failureCodes');

var System = require('../../../modules/system');
var SchemaDynamicTests = require('../../common/schemaDynamicTest');

describe('handshake', function () {

	var system;
	var handshake;
	var minVersion = '1.0.0';
	var validPeerNonce = randomstring.generate(16);
	var validNodeNonce = randomstring.generate(16);
	var validConfig = {
		config: {
			version: config.version,
			minVersion: minVersion,
			nethash: config.nethash,
			nonce: validNodeNonce
		}
	};
	var validHeaders;

	before(function (done) {
		new System(function (err, __system) {
			system = __system;
			handshake = wsApi.middleware.Handshake(system);
			done(err);
		}, validConfig);
	});

	describe('compatibility', function () {

		beforeEach(function () {
			validHeaders = {
				port: 5000,
				nethash: config.nethash,
				version: minVersion,
				nonce: validPeerNonce,
				height: 1
			};
		});

		it('should return an error when nonce is identical to server', function (done) {
			validHeaders.nonce = validConfig.config.nonce;
			handshake(validHeaders, function (err) {
				expect(err).to.have.property('code').equal(failureCodes.INCOMPATIBLE_NONCE);
				expect(err).to.have.property('description').equal('Expected nonce to be not equal to: ' + validConfig.config.nonce);
				done();
			});
		});

		it('should return an error when nethash does not match', function (done) {
			validHeaders.nethash = 'DIFFERENT_NETWORK_NETHASH';
			handshake(validHeaders, function (err) {
				expect(err).to.have.property('code').equal(failureCodes.INCOMPATIBLE_NETWORK);
				expect(err).to.have.property('description').contain('Expected nethash: ' + config.nethash + ' but received: ' + validHeaders.nethash);
				done();
			});
		});

		it('should return an error when version is incompatible', function (done) {
			validHeaders.version = '0.0.0';
			handshake(validHeaders, function (err) {
				expect(err).to.have.property('code').equal(failureCodes.INCOMPATIBLE_VERSION);
				expect(err).to.have.property('description').equal('Expected version: ' + minVersion + ' but received: ' + validHeaders.version);
				done();
			});
		});
	});

	after(function () {

		validHeaders = {
			port: 5000,
			nethash: config.nethash,
			version: minVersion,
			nonce: '0123456789ABCDEF',
			height: 1
		};

		describe('schema', function () {

			var schemaDynamicTests = new SchemaDynamicTests({
				customInput: {
					invalidHeadersErrorCode: failureCodes.INVALID_HEADERS
				},
				customArgumentAssertion: function (input, expectedType, err) {
					expect(err).to.have.property('code').equal(this.customInput.invalidHeadersErrorCode);
					expect(err).to.have.property('description').equal('#/: Expected type ' + expectedType + ' but found type ' + input.expectation);
				},
				customPropertyAssertion: function (input, expectedType, property, err) {
					expect(err).to.have.property('code').equal(this.customInput.invalidHeadersErrorCode);
					expect(err).to.have.property('description').equal('#/' + property + ': Expected type ' + expectedType + ' but found type ' + input.expectation);
				},
				customRequiredPropertiesAssertion: function (property, err) {
					expect(err).to.have.property('code').equal(failureCodes.INVALID_HEADERS);
					expect(err).to.have.property('description').equal('#/: Missing required property: ' + property);
				}
			});

			schemaDynamicTests.schema.shouldFailAgainst.nonObject.arguments(handshake);

			schemaDynamicTests.schema.shouldFailAgainst.nonString.property(handshake, validHeaders, 'nonce');
			schemaDynamicTests.schema.shouldFailAgainst.nonInteger.property(handshake, validHeaders, 'height');
			schemaDynamicTests.schema.shouldFailAgainst.nonString.property(handshake, validHeaders, 'nethash');
			schemaDynamicTests.schema.shouldFailAgainst.nonString.property(handshake, validHeaders, 'version');

			schemaDynamicTests.schema.shouldFailWithoutRequiredProperties(handshake, validHeaders, ['port', 'version', 'nonce', 'nethash', 'height']);
		});
	});
});
