var AVR109 = require('chip.avr.avr109');
var colors = require('colors');
var Serialport = serialport;
var async = require('async');
var Protocol = require('./protocol');
var util = require('util');
var os = require('os');

var Avr109 = function(options) {
    options.protocol = function() { return AVR109; };

    Protocol.call(this, options);
};

util.inherits(Avr109, Protocol);

/**
 * Uploads the provided hex file to the board, via the AVR109 protocol
 *
 * @param {string} hex - path of hex file for uploading
 * @param {function} callback - function to run upon completion/error
 */
Avr109.prototype._upload = function(file, callback) {
    var _this = this;
    var data;

    data = file;

    var reset;

    var writeTimeout = null;

    function write() {
        _this._write(data, function(error) {
            clearInterval(writeTimeout);

            var color = (error ? colors.red : colors.green);
            _this.debug(color('flash complete.'));

            // Can't close the serialport on avr109 boards >> node-serialport/issues/415
            // nvm this ^^^^^^
            return _this.connection.serialPort.close(callback.bind(null, null));
        });
    }

    function openAndWrite() {
        _this.connection.serialPort.open(function(error) {
            if (error) {
                _this.debug('Error opening serial port after reset', error);
                return callback(error);
            }

            if (!_this.connection.serialPort.isOpen()) {
                _this.debug('Serial port did not open correctly');
                return setTimeout(openAndWrite, 1000);
            }

            _this.debug('Opened serial connection', _this.connection.serialPort.isOpen());

            writeTimeout = setTimeout(() => {
                _this.debug('No progress on write. Trying again');
                reset();
            }, 25000);

            write();
        });
    }

    reset =  function reset() {
        _this._reset(function(error) {
            if (error) { return callback(error); }

            _this.debug('reset complete.');
            _this.debug('Opening serial connection', _this.connection.serialPort.isOpen());

            openAndWrite();
        });
    }

    reset();

};

/**
 * Performs the writing part of uploading to an AVR109 bootloaded chip
 *
 * @param {buffer} data - hex buffer to write to the chip
 * @param {function} callback - function to run upon completion/error
 */
Avr109.prototype._write = function(data, callback) {
    var _this = this;

    var options = {
        signature: _this.board.signature.toString(),
        debug: false
    };

    _this.chip.init(_this.connection.serialPort, options, function(error, flasher) {
        if (error) { return callback(error); }

        _this.debug('flashing, please wait...');

        async.series([
            flasher.erase.bind(flasher),
            flasher.program.bind(flasher, data.toString()),
            function verify(done) {
                // please see noopkat/avrgirl-arduino/issues/45 on github
                if (os.platform() !== 'linux') {
                    flasher.verify(done);
                } else {
                    done();
                }
            },

            flasher.fuseCheck.bind(flasher)
        ],
        function(error) {
            return callback(error);
        });
    });
};

/**
 * Software resets an Arduino AVR109 bootloaded chip into bootloader mode
 *
 * @param {function} callback - function to run upon completion/error
 */
Avr109.prototype._reset = function(callback) {
    var _this = this;
    var delay = 500;
    var conn;

    // creating a temporary connection for resetting only
    var tempSerialPort = new Serialport.SerialPort(_this.connection.options.port, {
        baudRate: 1200,
    }, false);

    _this.connection.serialPort = tempSerialPort;
    conn = _this.connection;

    _this.debug('resetting board...');

    async.series([
        tempSerialPort.open.bind(tempSerialPort),
        function(callback) {
            _this.debug('Opened Serial Port');
            setTimeout(callback, 500);
        },
        function(callback) {
            _this.debug('Cycling...');
            callback();
        },
        conn._cycleDTR.bind(conn),
        conn._cycleDTR.bind(conn),
        function(callback) {
            _this.debug('Cycled DTR Twice');

            serialport.list(console.log.bind(console, 'Post DTR Ports'));

            tempSerialPort.close(console.log.bind(console, 'Closed Serial Port'));
            setTimeout(callback, 1000);
        },
        conn._setUpSerial.bind(conn),
        conn._pollForPort.bind(conn)
    ],
    function(error) {
        if (error) {
            console.error('Error resetting', error);
            setTimeout(_this._reset.bind(_this, callback), 2000);
        } else {
            setTimeout(callback, 1000);
        }
    });
};

module.exports = Avr109;
