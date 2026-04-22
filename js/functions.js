
/*
    TODO:
	1. firmware upgrade
	2. FD/RD threshold
*/

var debug = 1;
var show_debug = 0;
var debug_log = [];
var show_page = 'settings';
var device_type = "";
var first_call = 1;
var chain = null;
var single_set = 0;

const cmd_getKey = 0x11;
const cmd_getLockInfo = 0x31;
const cmd_getPowerInfo = 0x42;
const cmd_getTransmissionVersionInfo = 0x60;
const cmd_getFrontAndRearDerailleurGearValuesInfo = 0x61;
const cmd_backDialSleep = 0x63;
const cmd_backSetting2p = 0x66;
const cmd_backSetting1p = 0x67;
const cmd_setFrontGearLimit = 0x82;
const cmd_fineTuneFrontGear = 0x85;
const cmd_getDeviceMac = 0x86;
const cmd_frontStatusReport = 0x88;
const cmd_frontLifting = 0x89;
const cmd_shutdown = 0x90;
const cmd_setTotalGear = 0x91;
const cmd_setGearUpValue = 0x92;
const cmd_setProtectionThreshold = 0x93;
const cmd_fineTuneGear = 0x95;
const cmd_getCurrentGear = 0x97;
const cmd_serverReportGear = 0x98;
const cmd_switchFingerOrder = 0x9c;
const cmd_rearLifting = 0x99;
const cmd_startRead = 0xfa;
const cmd_read = 0xfb;

const locale = new Intl.Locale(navigator.language);

var dev;
var characteristic_TX;

var blocks = 0;
var current_block = 0;
var key = 0;
var info = {};
var raw_info = [];
var all_gears = [];
var qtimeout;
var ctimeout;
var _localStorage = !!window.localStorage && $.isFunction(localStorage.getItem) && $.isFunction(localStorage.setItem) && $.isFunction(localStorage.removeItem);

const broadcast = new BroadcastChannel('dreds-channel');
broadcast.onmessage = (event) => {
    if (event.data && event.data.type == "VERSION")
	log(event.data.payload);
    else
    if (event.data && event.data.type == "CACHE")
	for (var t in event.data.payload)
	    log(event.data.payload[t]);
    else
    if (event.data && event.data.type == "ACTIVATE") {
	if (event.data.payload == "RELOAD")
	    window.location.reload();
    }
};

function log(s)
{
    if (debug) {
	s = s.replace(/\0/g, "\n").trim();

	var d = new Date();
	var ts = d.getFullYear() +
	    (d.getMonth() + 1).toString().padStart(2, '0') +
	    d.getDate().toString().padStart(2, '0') +
	    d.getHours().toString().padStart(2, '0') +
	    d.getMinutes().toString().padStart(2, '0') +
	    d.getSeconds().toString().padStart(2, '0') +
	    '.' +
	    d.getMilliseconds().toString().padStart(3, '0');

	// GeX and OX2 spam with multiple messages when gear change which app to lag, so update logs only when debug is shown via menu button
	if (show_debug) {
	if ((device_type != "EDS OX2") && (device_type != "EDS GeX"))
	    $('.debug').append(ts + '> ' + s + '\n');
	    $('.debug').scrollTop($('.debug').prop("scrollHeight"));
	}

	debug_log.push(ts + '> ' + s);

	console.log(s);
    }
}

function _setItem(item, value)
{
    if (_localStorage)
	return localStorage.setItem(item, value);
    else {
	var expires = (new Date(Date.now() + (365 * 24 * 60 * 60) * 1000)).toUTCString();

	var c = document.cookie.split(";");
	if (c[0].trim() != "") {
	    var c = c[0].trim().split('=');
	    if (c[0] == "storage") {
		var c = JSON.parse(c[1]);
		c[item] = value;
	    }
	} else {
	    var c = { item: value };
	}

	document.cookie = "storage=" + JSON.stringify(c) + '; expires=' + expires;

	return true;
    }
}

function _getItem(item)
{
    if (_localStorage)
	return localStorage.getItem(item);
    else {
	var c = document.cookie.split(";");
	if (c[0].trim() != "") {
	    var c = c[0].trim().split('=');
	    if (c[0] == "storage") {
		var c = JSON.parse(c[1]);
		var expires = (new Date(Date.now() + (365 * 24 * 60 * 60) * 1000)).toUTCString();
		document.cookie = "storage=" + JSON.stringify(c) + '; expires=' + expires;

		if (c.hasOwnProperty(item)) {
		    return c[item];
		} else
		    return null;
	    }
	}
    }
}

function setup()
{
    $('.settings').hide();
    $('.txsettings').hide();
    $('.gxsettings').hide();
    $('.ox2settings').hide();
    $('.scan').show();
    $('.debug').html('');
    $('.info .content').hide();
    $('.info .txcontent').hide();
    $('.info .gxcontent').hide();
    $('.info .ox2content').hide();
    $('.live').hide();
    $('.button_page').hide();
    $('.button_shutdown').hide();
    $('.button_disconnect').hide();
    $('.button_export').hide();
    $('.button_import').hide();
    info = {};
    raw_info = [];
}

function onDisconnect()
{
    endBlock();
    log('Disconnected');
    setup();
}

function percentage(v)
{
    if (v >= 820) return 100;
    if ((v < 820) && (v >= 816)) return 95;
    if ((v < 816) && (v >= 812)) return 90;
    if ((v < 812) && (v >= 808)) return 85;
    if ((v < 808) && (v >= 800)) return 80;
    if ((v < 800) && (v >= 792)) return 75;
    if ((v < 792) && (v >= 780)) return 70;
    if ((v < 780) && (v >= 776)) return 65;
    if ((v < 776) && (v >= 770)) return 60;
    if ((v < 770) && (v >= 766)) return 55;
    if ((v < 766) && (v >= 760)) return 50;
    if ((v < 760) && (v >= 750)) return 40;
    if ((v < 750) && (v >= 746)) return 35;
    if ((v < 746) && (v >= 740)) return 30;
    if ((v < 740) && (v >= 736)) return 25;
    if ((v < 736) && (v >= 730)) return 20;
    if ((v < 730) && (v >= 710)) return 10;
    if ((v < 710) && (v >= 690)) return 5;
    if ((v < 690) && (v >= 660)) return 0;
    return 0;
}

function handleCharacteristicValueChanged(event)
{
    const value = event.target.value;
    var payload = new Uint8Array(value.byteLength);
    var s = "";
    for (var t = 0; t < value.byteLength; t++) {
	payload[t] = value.getUint8(t);
	s += value.getUint8(t).toString(16).padStart(2, '0') + ' ';
    }
    log("Payload: " + s);

    var r = parsePacket(payload);

    if (r.ascii) return;

    if (r.cmd == cmd_getKey) {
	log("Received: getKey");

	key = r.key;

	// start read all the data
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_startRead, 0x00, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: startRead");
    } else
    if (r.cmd == cmd_startRead) {
	log("Received: startRead");

	blocks = r.payload[1];
	current_block = 0;

	startBlock(lang['L_GET_INFO'] + " " + (current_block + 1) + '/' + blocks, 0);
	// let's read all the data
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_read, 0x03, 0x00, current_block, 0x51, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: read -> block " + current_block);
    } else
    if (r.cmd == cmd_rearLifting) {
	// shift from gear
	log("Received: rearLifting");
    } else
    if (r.cmd == cmd_serverReportGear) {
	log("Received: serverReportGear");

	info['NUM'] = r.payload[4];
	var t = parseInt(r.payload[4]);
	t = parseInt(info['TOTAL_CNT']) - t + 1;
	if (r.payload[5] == 1)
	    log("RD start rearLifting to gear " + t);
	else
	    log("RD finish rearLifting to gear " + t);

	// show micro shift only on lowest gear
	var pr = "";
	if (device_type == "EDS TX") pr = "tx";
	if (device_type == "EDS GeX") pr = "gx";
	if (device_type == "EDS OX2") pr = "ox2";
	if (info['NUM'] == 1)
	    $('.' + pr + 'settings .micro').show();
	else
	    $('.' + pr + 'settings .micro').hide();

	$('.settings .action_buttons .button.gear, .ox2settings .action_buttons .button.gear, .txsettings .action_buttons .button.gear, .gxsettings .action_buttons .button.gear').html(t);
	$('.settings .action_buttons .button.gears select, .ox2settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select, .gxsettings .action_buttons .button.gears select').val(parseInt(info['TOTAL_CNT']));//.change();
	$('.live .gear').html(t);
	$('.live .gears').html('/' + info['TOTAL_CNT']);

	// chain
	if (chain != null) {
	    chain();
	}
	chain = null;
    } else
    if (r.cmd == cmd_frontStatusReport) {
	log("Received: frontStatusReport");

	if ((r.payload[4] > 0) && (r.payload[4] < 7)) {
	    info['Q_NUM'] = r.payload[4];
	    if ((info['Q_NUM'] == 1) || (info['Q_NUM'] == 2) || (info['Q_NUM'] == 3)) t = 1;
	    if ((info['Q_NUM'] == 4) || (info['Q_NUM'] == 5) || (info['Q_NUM'] == 6)) t = 2;

	    var pr = "";
	    if (device_type == "EDS TX") pr = "tx";
	    if (t == 1) {
		// show micro shift only on lowest gear
		$('.' + pr + 'settings .front_micro').show();
		$('.live .fgear').html(lang['L_FD_BIG']);
	    } else {
		$('.' + pr + 'settings .front_micro').hide();
		$('.live .fgear').html(lang['L_FD_SMALL']);
	    }

	    log("FD gear " + t);

	    $('.txsettings .front_buttons .button.gear').html(t);
	} else {
	    ;;;
	}
    } else
    if (r.cmd == cmd_switchFingerOrder) {
	log("Received: switchFingerOrder");

	// for some reason this always return 0 after change which may indicate OK,
	// but we ignore it - we just assume it switched buttons
	endBlock();
	if (
	    (device_type == "EDS OX") ||
	    (device_type == "EDS OX2")
	) {
	    if (r.payload[0] == 0x00) {
		clearTimeout(ctimeout);

		endBlock();
		if ($('.settings .buttons_function .vbutton:first-child').hasClass('up')) {
		    qalert(lang['L_REVERSED_BUTTONS']);
		    $('.settings .buttons_function .vbutton:first-child').removeClass('up');
		    $('.settings .buttons_function .vbutton:last-child').addClass('up');
		    $('.settings .buttons_function .vbutton:first-child').html(lang['L_DOWN']);
		    $('.settings .buttons_function .vbutton:last-child').html(lang['L_UP']);
		} else {
		    qalert(lang['L_NORMAL_BUTTONS']);
		    $('.settings .buttons_function .vbutton:first-child').addClass('up');
		    $('.settings .buttons_function .vbutton:last-child').removeClass('up');
		    $('.settings .buttons_function .vbutton:first-child').html(lang['L_UP']);
		    $('.settings .buttons_function .vbutton:last-child').html(lang['L_DOWN']);
		}
	    }
	} else
	if (device_type == "EDS TX") {
	    clearTimeout(ctimeout);
	    endBlock();
	} else
	if (device_type == "EDS GeX") {
	    clearTimeout(ctimeout);
	    endBlock();
	} else
	{
	    error(lang['L_COMMAND_FAILED']);
	}
    } else
    if (r.cmd == cmd_setTotalGear) {
	log("Received: setTotalGear");

	// for some reason this always return 0 after change which may indicate OK,
	// but we don't know actual gear values, so ...
	endBlock();
	if (r.payload[0] == 0x00) {
	    clearTimeout(ctimeout);
	    qalert(lang['L_NUMBER_OF_GEARS_CHANGED']);
	} else {
	    $('.settings .action_buttons .button.gears select').val(info['TOTAL_CNT']);

	    error(lang['L_COMMAND_FAILED']);
	}
	// re-read config
	info = {};
	raw_info = [];
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_startRead, 0x00, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: startRead");
    } else
    if (r.cmd == cmd_setGearUpValue) {
	log("Received: setGearUpValue");

	// for some reason this always return 0 after change which may indicate OK,
	// but we ignore it since we already have it in input field
	if (all_gears.length == 0) {
	    endBlock();
	}
	if (r.payload[0] == 0x00) {
	    clearTimeout(ctimeout);

	    // iterate on all remaining items into all_gears until all are gone
	    if (all_gears.length > 0) {
		var v = all_gears.shift();

		var v2 = (v.value & 0xFF);
		var v1 = ((v.value >> 8) & 0xFF);

		var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
		a = setCRC16(a);
		characteristic_TX.writeValueWithoutResponse(a);
		log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

		ctimeout = setTimeout(timeoutCheck, 1000);
	    } else {
		var prefix = "";
		if (device_type == "EDS TX") prefix = "tx";
		if (device_type == "EDS GeX") prefix = "gx";
		if (device_type == "EDS OX2") prefix = "ox2";
		var cg = parseInt($('.' + prefix + 'settings .action_buttons .button.gear').html());
		var tg = parseInt($('.' + prefix + 'settings .action_buttons .button.gears select').val());
		if ((single_set > 0) && (tg - single_set + 1 == cg)) {
		    var a = $('.' + prefix + 'settings .gear_values .vcontent .button.set_move').hasClass('selected');

		    if (a) {
			var f1 = 0x02;
			var f2 = 0x01;
			if (cg == tg) {
			    f1 = 0x01;
			    f2 = 0x02;
			}

			var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f1, 0x00, 0x00 ]);
			a = setCRC16(a);
			characteristic_TX.writeValueWithoutResponse(a);
			log("Send: rearLifting -> " + f1.toString(16).padStart(2, '0'));
			chain = function() {
			    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f2, 0x00, 0x00 ]);
			    a = setCRC16(a);
			    characteristic_TX.writeValueWithoutResponse(a);
			    log("Send: rearLifting -> " + f2.toString(16).padStart(2, '0'));
			}
		    }
		}
		single_set = 0;

		qalert(lang['L_GEAR_VALUE_UPDATED']);
	    }
	} else {
	    error(lang['L_COMMAND_FAILED']);
	}
    } else
    if (r.cmd == cmd_setFrontGearLimit) {
	log("Received: setFrontGearLimit");

	// for some reason this always return 0 after change which may indicate OK,
	// but we ignore it since we already have it in input field
	if (all_gears.length == 0) {
	    endBlock();
	}
	if (r.payload[0] == 0x00) {
	    clearTimeout(ctimeout);

	    // iterate on all remaining items into all_gears until all are gone
	    if (all_gears.length > 0) {
		var v = all_gears.shift();

		var v2 = (v.value & 0xFF);
		var v1 = ((v.value >> 8) & 0xFF);

		var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setFrontGearLimit, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
		a = setCRC16(a);
		characteristic_TX.writeValueWithoutResponse(a);
		log("Send: setFrontGearLimit -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

		ctimeout = setTimeout(timeoutCheck, 1000);
	    } else {
		qalert(lang['L_FRONT_GEAR_VALUE_UPDATED']);
	    }
	} else {
	    error(lang['L_COMMAND_FAILED']);
	}
    } else
    if (r.cmd == cmd_getFrontAndRearDerailleurGearValuesInfo)
    {
        log("Received: getFrontAndRearDerailleurGearValuesInfo");

        var s = "FD:";
        var f = 0;
        for (var t = 0; t < r.payload_length; t = t + 1)
        {
	    s += ' ' + r.payload[t].toString(16).padStart(2, '0');

	    if (parseInt(r.payload[t]) != 0) f = 1;
	}
	log(s);

	if (!f) {
	    $('.txsettings .fvnone').show();
	    $('.txsettings .gear_values .fvcontent').hide();
	    $('.txsettings .front_buttons').hide();
	    $('.txsettings .front_micro').hide();
	} else {
	    $('.txsettings .fvnone').hide();
	    $('.txsettings .gear_values .fvcontent').show();
	    $('.txsettings .front_buttons').show();
	    if (parseInt($('.txsettings .front_buttons .button.gear').html()) == 1)
		$('.txsettings .front_micro').show();
	}

	$('.txsettings .gear_values .fvcontent .content').html('');
	for (var t = 0; t < r.payload_length; t = t + 2) {
	    var v = r.payload[t] * 256;
	    v += r.payload[t + 1];
	    info['Q_GEA[' + ((t / 2) + 1) + ']'] = v;
	}
	info['Q_TOTAL'] = r.payload_length / 2;

	buildFrontValues();
	bindActionButtons();
    } else
    if (r.cmd == cmd_getTransmissionVersionInfo)
    {
	log("Received: getTransmissionVersionInfo");

	info['H_POWER'] = r.payload[0] * 256 + r.payload[1];
	info['R_POWER'] = r.payload[2] * 256 + r.payload[3];
	info['Q_POWER'] = r.payload[6] * 256 + r.payload[7];
	info['L_POWER'] = r.payload[8] * 256 + r.payload[9];

	if (parseInt(r.payload[12]) == 0)
	    $('.ox2settings .buttons_function .button.sleep, .txsettings .buttons_function .button.sleep, .gxsettings .buttons_function .button.sleep').addClass('selected');
	else
	    $('.ox2settings .buttons_function .button.sleep, .txsettings .buttons_function .button.sleep, .gxsettings .buttons_function .button.sleep').removeClass('selected');

	updateBattery();

	// check RD protection
	if (first_call) {
	    first_call = 0;

	    var f = 0x01;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_backSetting1p, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: backSetting1p -> " + f.toString(16).padStart(2, '0'));

	    qalert(lang['L_GET_RD_PROTECTION']);
	}

	// check if FD just wake up
	if ($('.txsettings .fvnone').is(":visible")) {
	    setTimeout(function() {
		if ((parseInt(r.payload[6]) != 0) && (parseInt(r.payload[7]) != 0)) {
		    log("FD waked up");
		    var f1 = 0x01;
		    var f2 = 0x01;
		    var f3 = 0x06;
		    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_getFrontAndRearDerailleurGearValuesInfo, 0x03, f1, f2, f3, 0x00, 0x00 ]);
		    a = setCRC16(a);
		    characteristic_TX.writeValueWithoutResponse(a);
		    log("Send: getFrontAndRearDerailleurGearValuesInfo -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

		    qalert(lang['L_GET_FD_INFORMATION']);
		}
	    }, 3000);
	}
    } else
    if (r.cmd == cmd_frontLifting)
    {
	log("Received: frontLifting");

	endBlock();
    } else
    if (r.cmd == cmd_setProtectionThreshold)
    {
	log("Received: setProtectionThreshold");

	endBlock();
	if (r.payload[0] == 0x00)
	{
	    clearTimeout(ctimeout);

	    if ($('.settings .buttons_function .button.mode').hasClass('selected'))
		$('.settings .buttons_function .button.mode').removeClass('selected');
	    else
		$('.settings .buttons_function .button.mode').addClass('selected');

	    if ($('.ox2settings .buttons_function .button.mode').hasClass('selected'))
		$('.ox2settings .buttons_function .button.mode').removeClass('selected');
	    else
		$('.ox2settings .buttons_function .button.mode').addClass('selected');

	    if ($('.txsettings .buttons_function .button.mode').hasClass('selected'))
		$('.txsettings .buttons_function .button.mode').removeClass('selected');
	    else
		$('.txsettings .buttons_function .button.mode').addClass('selected');

	    if ($('.gxsettings .buttons_function .button.mode').hasClass('selected'))
		$('.gxsettings .buttons_function .button.mode').removeClass('selected');
	    else
		$('.gxsettings .buttons_function .button.mode').addClass('selected');
	} else {
	    error(lang['L_COMMAND_FAILED']);
	}
    } else
    if (r.cmd == cmd_backDialSleep)
    {
	log("Received: backDialSleep");

	endBlock();
	if (r.payload[0] == 0x00)
	{
	    clearTimeout(ctimeout);

	    if ($('.ox2settings .buttons_function .button.sleep').hasClass('selected'))
		$('.ox2settings .buttons_function .button.sleep').removeClass('selected');
	    else
		$('.ox2settings .buttons_function .button.sleep').addClass('selected');

	    if ($('.txsettings .buttons_function .button.sleep').hasClass('selected'))
		$('.txsettings .buttons_function .button.sleep').removeClass('selected');
	    else
		$('.txsettings .buttons_function .button.sleep').addClass('selected');

	    if ($('.gxsettings .buttons_function .button.sleep').hasClass('selected'))
		$('.gxsettings .buttons_function .button.sleep').removeClass('selected');
	    else
		$('.gxsettings .buttons_function .button.sleep').addClass('selected');
	} else {
	    error(lang['L_COMMAND_FAILED']);
	}
    } else
    if (r.cmd == cmd_backSetting1p)
    {
	log("Received: backSetting1p");

	if (r.payload[0] == 0x01)
	{
	    $('.txsettings .buttons_function .button.rdprotect').addClass('selected');
	} else {
	    $('.txsettings .buttons_function .button.rdprotect').removeClass('selected');
	}
    } else
    if (r.cmd == cmd_backSetting2p)
    {
	log("Received: backSetting2p");

	endBlock();
	if (r.payload[0] == 0x00)
	{
	    clearTimeout(ctimeout);

	    if ($('.txsettings .buttons_function .button.rdprotect').hasClass('selected'))
		$('.txsettings .buttons_function .button.rdprotect').removeClass('selected');
	    else
		$('.txsettings .buttons_function .button.rdprotect').addClass('selected');
	} else {
	    error(lang['L_COMMAND_FAILED']);
	}
    }
}

function parsePacket(hex, check_confirm = 0)
{
    var r = { };
    r.payload = [];
    r.payload_length = 0;
    r.ascii = false;

    r.error = 0;
    var crc = hex[hex.byteLength - 2] << 8 | hex[hex.byteLength - 1];
    var crcc = crc16(hex);

    var u8 = (hex[1] - 50) & 255;
    r.key = hex[2] ^ u8;
    r.cmd = hex[3] ^ u8;
    r.length = hex[4] ^ u8;

    if (crc == crcc) {
	log("CRC: " + crc.toString(16).padStart(2, '0') + " = " + crcc.toString(16).padStart(2, '0') + " -> OK");
    } else {
	if (blocks == 0) {
	    log("CRC: " + crc.toString(16).padStart(2, '0') + " != " + crcc.toString(16).padStart(2, '0') + " -> FAILED");
	    r.error = 1;
	    return r;
	} else {
	    r.length = 20; // !FIXME!

	    // plain ascii
	    log("CRC: skip - ASCII content\n");
	    r.ascii = true;
	}
    }
    if (!r.ascii) {
	log("prefix: " + hex[0].toString(16).padStart(2, '0'));
	log("u8: " + u8.toString(16).padStart(2, '0'));
	log("key: " + r.key.toString(16).padStart(2, '0'));
	log("cmd: " + r.cmd.toString(16).padStart(2, '0'));
	log("length: " + r.length);

	for (var t = 5; t < 5 + r.length; t++) {
		r.payload[t - 5] = hex[t] ^ u8;
		r.payload_length++;
	}
	var s = "";
	for (var t = 0; t < r.payload_length; t++) {
	    s += r.payload[t].toString(16).padStart(2, '0') + ' ';
	}
	log("payload: " + s);
    } else {
	for (var t = 0; t < r.length; t++) {
	    r.payload[t] = hex[t];
	    r.payload_length++;
	}

	// skip first 4 bytes = unknown what they are
	var s = "";
	for (var t = 4; t < r.payload_length; t++) {
	    s += String.fromCharCode(r.payload[t]);
	}

	log("block " + hex[3] + ": " + s);
	raw_info.push(s);

	current_block++;
	if (current_block < blocks) {
	    startBlock(lang['L_GET_INFO'] + " " + current_block + '/' + blocks, 0);

	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_read, 0x03, 0x00, current_block, 0x51, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: read block -> " + current_block);
	} else {
	    blocks = 0;

	    raw_info = raw_info.join('');
	    var a = raw_info.split("\n");
	    for (var t = 0; t < a.length; t++) {
		if (a[t].substr(0, 8) == "MCU_DATA") {
		    var b = a[t].split(',');
		    var c = b[0].split(':');
		    info[c[0]] = c[1] + ',' + b[1] + ',' + b[2] + ',' + b[3] + ',' + b[4];
		    var c = b[5].split(':');
		    info[c[0]] = c[1] + ',' + b[6] + ',' + b[7];
		} else {
		    var b = a[t].split(",");
		    for (var r = 0; r < b.length; r++) {
			if (b[r] != "") {
			    var c = b[r].split(':');
			    info[c[0]] = c[1];
			}
		    }
		}
	    }

	    endBlock();
	    if (device_type == "EDS OX")
		$('.settings').show();
	    else
	    if (device_type == "EDS OX2")
		$('.ox2settings').show();
	    else
	    if (device_type == "EDS TX") {
		$('.txsettings').show();
		$('.live .action_buttons .button.front').show();
	    } else
	    if (device_type == "EDS GeX")
		$('.gxsettings').show();
	    $('.scan').hide();
	    $('.settings .micro').hide();
	    if (device_type == "EDS OX")
		$('.info .content').show();
	    else
	    if (device_type == "EDS OX2")
		$('.info .ox2content').show();
	    else
	    if (device_type == "EDS TX")
		$('.info .txcontent').show();
	    else
	    if (device_type == "EDS GeX")
		$('.info .gxcontent').show();
	    $('.button_page').show();
	    $('.button_disconnect').show();
	    if ((device_type == "EDS TX") || (device_type == "EDS GeX") || (device_type == "EDS OX2"))
		$('.button_shutdown').show();
	    $('.button_export').show();
	    $('.button_import').show();

	    show_page = _getItem('show_page');
	    // set show_page by default
	    if (show_page == null) show_page = 'settings';
	    if (show_page == 'settings') {
		if (device_type == "EDS OX")
		    $('.settings').show();
		else
		if (device_type == "EDS OX2")
		    $('.ox2settings').show();
		else
		if (device_type == "EDS TX")
		    $('.txsettings').show();
		else
		if (device_type == "EDS GeX")
		    $('.gxsettings').show();
		$('.live').hide();
		$('.info').removeClass('big');
		$('.button_page').removeClass('icon-wrench').addClass('icon-bike');
	    } else {
		$('.settings').hide();
		$('.txsettings').hide();
		$('.gxsettings').hide();
		$('.ox2settings').hide();
		$('.live').show();
		$('.info').addClass('big');
		$('.button_page').removeClass('icon-bike').addClass('icon-wrench');
	    }

	    var t = parseInt(info['NUM']);
	    t = parseInt(info['TOTAL_CNT']) - t + 1;
	    $('.settings .action_buttons .button.gear, .ox2settings .action_buttons .button.gear, .txsettings .action_buttons .button.gear, .gxsettings .action_buttons .button.gear').html(t);
	    $('.settings .action_buttons .button.gears select, .ox2settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select, .gxsettings .action_buttons .button.gears select').val(parseInt(info['TOTAL_CNT']));//.change();
	    $('.live .gear').html(t);
	    $('.live .gears').html('/' + info['TOTAL_CNT']);

	    if (device_type == "EDS TX") {
		// for some reason TX don't always initialize Q values at first
		if (parseInt(info['Q_TOTAL']) == 0) {
		    var f1 = 0x01;
		    var f2 = 0x01;
		    var f3 = 0x06;
		    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_getFrontAndRearDerailleurGearValuesInfo, 0x03, f1, f2, f3, 0x00, 0x00 ]);
		    a = setCRC16(a);
		    characteristic_TX.writeValueWithoutResponse(a);
		    log("Send: getFrontAndRearDerailleurGearValuesInfo -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

		    qalert(lang['L_GET_FD_INFORMATION']);
		}

		t = 1;
		if ((info['Q_NUM'] == 1) || (info['Q_NUM'] == 2) || (info['Q_NUM'] == 3)) t = 1;
		if ((info['Q_NUM'] == 4) || (info['Q_NUM'] == 5) || (info['Q_NUM'] == 6)) t = 2;
		$('.txsettings .front_buttons .button.gear').html(t);
		if (t == 1)
		    $('.live .fgear').html(lang['L_FD_BIG']);
		else
		    $('.live .fgear').html(lang['L_FD_SMALL']);
	    }

	    updateBattery();

	    if (device_type == "EDS OX") {
		$('.settings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.settings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(info['GEARS[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">' + lang['L_SET'] + '</div></div>');
		}
	    } else
	    if (device_type == "EDS OX2") {
		$('.ox2settings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.ox2settings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(info['H_GEA[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">' + lang['L_SET'] + '</div></div>');
		}
	    } else
	    if (device_type == "EDS TX") {
		buildFrontValues();

		$('.txsettings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.txsettings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(info['H_GEA[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">' + lang['L_SET'] + '</div></div>');
		}
	    } else
	    if (device_type == "EDS GeX") {
		$('.gxsettings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.gxsettings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(info['H_GEA[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">' + lang['L_SET'] + '</div></div>');
		}
	    }

	    // show micro shift only on lowest gear
	    var pr = "";
	    if (device_type == "EDS TX") pr = "tx";
	    if (device_type == "EDS GeX") pr = "gx";
	    if (device_type == "EDS OX2") pr = "ox2";
	    if (info['NUM'] == 1)
		$('.' + pr + 'settings .micro').show();
	    else
		$('.' + pr + 'settings .micro').hide();

	    bindActionButtons();
	    buildPresets();

	    // race mode
	    if (info['PTOTECT'] == 1)
		$('.settings .buttons_function .button.mode, .ox2settings .buttons_function .button.mode, .txsettings .buttons_function .button.mode, .gxsettings .buttons_function .button.mode').addClass('selected');
	    else
		$('.settings .buttons_function .button.mode, .ox2settings .buttons_function .button.mode, .txsettings .buttons_function .button.mode, .gxsettings .buttons_function .button.mode').removeClass('selected');

	    // buttons
	    if (device_type == "EDS OX") {
		//$('.settings .buttons_function .button').removeClass('selected');
		if (parseInt(info['KeySwitch']) == 0) {
		    $('.settings .buttons_function .vbutton:first-child').addClass('up');
	    	    $('.settings .buttons_function .vbutton.top').html(lang['L_UP']);
	    	    $('.settings .buttons_function .vbutton.bottom').html(lang['L_DOWN']);
		} else {
		    $('.settings .buttons_function .vbutton:last-child').addClass('up');
	    	    $('.settings .buttons_function .vbutton.top').html(lang['L_DOWN']);
	    	    $('.settings .buttons_function .vbutton.bottom').html(lang['L_UP']);
		}
	    } else
	    if (device_type == "EDS OX2") {
		//$('.settings .buttons_function .button').removeClass('selected');
		if (info['KeySwitch'].substring(1, 2) == 2) {
		    $('.settings .buttons_function .vbutton:first-child').addClass('up');
	    	    $('.settings .buttons_function .vbutton.top').html(lang['L_UP']);
	    	    $('.settings .buttons_function .vbutton.bottom').html(lang['L_DOWN']);
		} else {
		    $('.settings .buttons_function .vbutton:last-child').addClass('up');
	    	    $('.settings .buttons_function .vbutton.top').html(lang['L_DOWN']);
	    	    $('.settings .buttons_function .vbutton.bottom').html(lang['L_UP']);
		}
	    } else
	    if (device_type == "EDS TX") {
		if (parseInt(info['KeySwitch'].substring(0, 1)) == 1) $('.txsettings .buttons_function .vbutton.small select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(0, 1)) == 2) $('.txsettings .buttons_function .vbutton.small select').val('down');//lang['L_DOWN'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(0, 1)) == 3) $('.txsettings .buttons_function .vbutton.small select').val('front');//lang['L_FRONT'].toLowerCase()

		if (parseInt(info['KeySwitch'].substring(1, 2)) == 1) $('.txsettings .buttons_function .vbutton.big select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(1, 2)) == 2) $('.txsettings .buttons_function .vbutton.big select').val('down');//lang['L_DOWN'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(1, 2)) == 3) $('.txsettings .buttons_function .vbutton.big select').val('front');//lang['L_FRONT'].toLowerCase()

		if (parseInt(info['KeySwitch'].substring(2, 3)) == 1) $('.txsettings .buttons_function .button.single select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(2, 3)) == 2) $('.txsettings .buttons_function .button.single select').val('down');//lang['L_DOWN'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(2, 3)) == 3) $('.txsettings .buttons_function .button.single select').val('front');//lang['L_FRONT'].toLowerCase()
	    } else
	    if (device_type == "EDS GeX") {
		if (parseInt(info['KeySwitch'].substring(0, 1)) == 1) $('.gxsettings .buttons_function .vbutton.small select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(0, 1)) == 2) $('.gxsettings .buttons_function .vbutton.small select').val('down');//lang['L_DOWN'].toLowerCase()

		if (parseInt(info['KeySwitch'].substring(1, 2)) == 1) $('.gxsettings .buttons_function .vbutton.big select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(1, 2)) == 2) $('.gxsettings .buttons_function .vbutton.big select').val('down');//lang['L_DOWN'].toLowerCase()

		if (parseInt(info['KeySwitch'].substring(2, 3)) == 1) $('.gxsettings .buttons_function .button.single select').val('up');//lang['L_UP'].toLowerCase()
		if (parseInt(info['KeySwitch'].substring(2, 3)) == 2) $('.gxsettings .buttons_function .button.single select').val('down');//lang['L_DOWN'].toLowerCase()
	    }

	    if ((device_type == "EDS TX") || (device_type == "EDS GeX") || (device_type == "EDS OX2")) {
		// send getTransmissionVersionInfo to get sleep status
		var a = new Uint8Array([ 0xfe, 0x32, key, cmd_getTransmissionVersionInfo, 0x00, 0x00, 0x00 ]);
		a = setCRC16(a);
		characteristic_TX.writeValueWithoutResponse(a);
		log("Send: getTransmissionVersionInfo");
		qalert(lang['L_GET_SLEEP_STATUS']);
	    }
	}
    }

    return r;
}

function getSupportedProperties(characteristic)
{
    let supportedProperties = [];
    for (const p in characteristic.properties) {
	if (characteristic.properties[p] === true) {
		supportedProperties.push(p.toUpperCase());
	}
    }
    return '[' + supportedProperties.join(', ') + ']';
}

function timeoutCheck()
{
    endBlock();
    error(lang['L_COMMAND_FAILED']);
}

function buildPresets()
{
    var gears = JSON.parse(_getItem('gears'));
    if (gears == null) gears = {};

    if (gears[device_type] == null) return;

    var s = '';
    for (var t in gears[device_type]) {
	s += '<div class="preset_wrap"><div class="button preset" preset="' + t + '">' + t + '</div><div class="button del" preset="' + t + '">x</div></div>';
    }
    var pr = "";
    if (device_type == "EDS TX") pr = "tx";
    if (device_type == "EDS GeX") pr = "gx";
    if (device_type == "EDS OX2") pr = "ox2";
    $('.' + pr + 'settings .gear_values .presets').html(s);

    $('.' + pr + 'settings .gear_values .presets .preset').off('click').on('click', function() {
	try {
	    var a = JSON.parse(_getItem('gears'));
	    if (a[device_type] != null) {
		for (var t in a[device_type][$(this).attr('preset')]['rear'])
		{
			$('.' + pr + 'settings .gear_values .vcontent .content .gear[gear="' + a[device_type][$(this).attr('preset')]['rear'][t].gear + '"] input').val(a[device_type][$(this).attr('preset')]['rear'][t].value);
		}
		if (device_type == "EDS TX") {
		    for (var t in a[device_type][$(this).attr('preset')]['front'])
			$('.txsettings .gear_values .fvcontent .content .front[front="' + a[device_type][$(this).attr('preset')]['front'][t].gear + '"] input').val(a[device_type][$(this).attr('preset')]['front'][t].value);
		}
	    }
	    
	    updateSparklines();

	    qalert(lang['L_PRESET_LOADED'].replace('%s', $(this).attr('preset')));
	} catch(error) {
	    ;;;
	}
    });
    $('.' + pr + 'settings .gear_values .presets .del').off('click').on('click', function() {
	var pname =  $(this).attr('preset');

       _dialog(lang['L_PRESET_CONFIRM_DELETE'].replace('%s', pname), '', function(e) {
           e.preventDefault();
           closePopup();
       }, function(e) {
           e.preventDefault();
           try {
               var a = JSON.parse(_getItem('gears'));
               if (a[device_type] != null)
                   delete a[device_type][pname];

               _setItem('gears', JSON.stringify(a));

               buildPresets();

               qalert(lang['L_PRESET_DELETED'].replace('%s', pname));

               closePopup();
           } catch(error) {
               ;;;
           }
       });

	/*if (confirm(lang['L_PRESET_CONFIRM_DELETE'].replace('%s', pname))) {
	    try {
		var a = JSON.parse(_getItem('gears'));
		if (a[device_type] != null)
		    delete a[device_type][$(this).attr('preset')];

		_setItem('gears', JSON.stringify(a));

		buildPresets();

		qalert(lang['L_PRESET_DELETED'].replace('%s', pname));
	    } catch(error) {
		;;;
	    }
	}*/
    });
}

function buildFrontValues()
{
    $('.txsettings .gear_values .fvcontent .content').html('');
    for (var t = 1; t <= parseInt(info['Q_TOTAL']); t++) {
        $('.txsettings .gear_values .fvcontent .content').append('<div class="front" front="' + t + '"><div class="sparkline"><div class="dot"></div></div><div class="button minus">-</div><input type="text" inputmode="numeric" pattern="[0-9]*" value="' + parseInt(info['Q_GEA[' + t + ']']) + '"><div class="button plus front' + t + '">+</div><div class="button set">' + lang['L_SET'] + '</div></div>');
    }
}

function updateSparklines() {
    var prefixes = ['.settings', '.ox2settings', '.txsettings', '.gxsettings'];
    prefixes.forEach(function(pr) {
        var blocks = [pr + ' .gear_values .vcontent .content', pr + ' .gear_values .fvcontent .content'];
        blocks.forEach(function(blockSel) {
            var container = $(blockSel);
            if (container.length === 0) return;

            var inputs = container.find('input');
            if (inputs.length === 0) return;

            var min = Infinity;
            var max = -Infinity;

            inputs.each(function() {
                var v = parseInt($(this).val());
                if (!isNaN(v)) {
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            });

            if (min === Infinity || max === -Infinity) return;

            inputs.each(function() {
                var v = parseInt($(this).val());
                if (!isNaN(v)) {
                    var percent = 0;
                    if (max > min) {
                        percent = ((v - min) / (max - min)) * 100;
                    }
                    $(this).siblings('.sparkline').find('.dot').css('left', percent + '%');
                }
            });
        });
    });
}

function bindActionButtons()
{
    updateSparklines();

    $('.settings, .ox2settings, .txsettings, .gxsettings').off('keyup change', '.gear_values .content input').on('keyup change', '.gear_values .content input', function() {
        updateSparklines();
    });

    // set gear values
    $(document).off('click', '.step-btn').on('click', '.step-btn', function() {
        $(this).siblings().removeClass('selected');
        $(this).addClass('selected');
    });

    $('.settings .gear_values .vcontent .content .button.minus, .ox2settings .gear_values .vcontent .content .button.minus, .txsettings .gear_values .vcontent .content .button.minus, .txsettings .gear_values .fvcontent .content .button.minus, .gxsettings .gear_values .vcontent .content .button.minus').off('click').on('click', function() {
	var step = parseInt($(this).closest('.gear_values').find('.step-control .selected').attr('data-step')) || 1;
	var v = parseInt($(this).next().val());
	if (v >= step) v -= step;
	else v = 0;
	$(this).next().val(v);
	updateSparklines();
    });
    $('.settings .gear_values .vcontent .content .button.plus, .ox2settings .gear_values .vcontent .content .button.plus, .txsettings .gear_values .vcontent .content .button.plus, .txsettings .gear_values .fvcontent .content .button.plus, .gxsettings .gear_values .vcontent .content .button.plus').off('click').on('click', function() {
	var step = parseInt($(this).closest('.gear_values').find('.step-control .selected').attr('data-step')) || 1;
	var v = parseInt($(this).prev().val());
	v += step;
	$(this).prev().val(v);
	updateSparklines();
    });
    $('.settings .gear_values .vcontent .content .button.set, .ox2settings .gear_values .vcontent .content .button.set, .txsettings .gear_values .vcontent .content .button.set, .gxsettings .gear_values .vcontent .content .button.set').off('click').on('click', function() {
	startBlock(lang['L_UPDATE_VALUE']);

	var g = $(this).parent().attr('gear');
	var v = $(this).prev().prev().val();

	var v2 = (v & 0xFF);
	var v1 = ((v >> 8) & 0xFF);

	single_set = g;

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, g, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + g.toString(16).padStart(2, '0') + ' = ' + v);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .gear_values .fvcontent .content .button.set').off('click').on('click', function() {
	startBlock(lang['L_UPDATE_LIMIT']);

	var g = $(this).parent().attr('front');
	var v = $(this).prev().prev().val();

	var v2 = (v & 0xFF);
	var v1 = ((v >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setFrontGearLimit, 0x03, g, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setFrontGearLimit -> " + g.toString(16).padStart(2, '0') + ' = ' + v);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
}

function updateBattery()
{
    var b = _getItem('battery');
    if (device_type == "EDS OX") {
	$('.info .content .left .left_ver').html(info['GEARS_V']);
	if (b == 'percent') {
	    $('.info .content').attr('type', 'percent');
	    $('.info .content .left .left_val').html(percentage(info['POWER_2']) + '%');
	} else {
	    $('.info .content').attr('type', 'volts');
	    $('.info .content .left .left_val').html((parseInt(info['POWER_2']) / 100).toFixed(2) + 'V');
	}

	$('.info .content .right .right_ver').html(info['REMOTE_V']);
	$('.info .content .right .right_val').html((parseInt(info['POWER_1']) / 100).toFixed(2) + 'V');
    } else
    if (device_type == "EDS OX2") {
	$('.info .ox2content .left .left_ver').html(info['H_Ver']);
	if (b == 'percent') {
	    $('.info .ox2content').attr('type', 'percent');
	    $('.info .ox2content .left .left_val').html(percentage(info['H_POWER']) + '%');
	} else {
	    $('.info .ox2content').attr('type', 'volts');
	    $('.info .ox2content .left .left_val').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');
	}

	$('.info .ox2content .right .right_ver').html(info['R_Ver']);
	$('.info .ox2content .right .right_val').html((parseInt(info['R_POWER']) / 100).toFixed(2) + 'V');
    }
    if (device_type == "EDS TX") {
        $('.info .txcontent .left .left_rver').html(info['H_Ver']);
        $('.info .txcontent .left .left_fver').html(info['Q_Ver']);
	if (b == 'percent') {
	    $('.info .txcontent').attr('type', 'percent');

	    $('.info .txcontent .left .left_fval').html(percentage(info['Q_POWER']) + '%');
	    $('.info .txcontent .left .left_rval').html(percentage(info['H_POWER']) + '%');
	} else {
	    $('.info .txcontent').attr('type', 'volts');

	    $('.info .txcontent .left .left_fval').html((parseInt(info['Q_POWER']) / 100).toFixed(2) + 'V');
	    $('.info .txcontent .left .left_rval').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');

	    if (b == null) _setItem('battery', 'volts');
	}

	$('.info .txcontent .right .right_lver').html(info['L_Ver']);
	$('.info .txcontent .right .right_rver').html(info['R_Ver']);
	$('.info .txcontent .right .right_lval').html((parseInt(info['L_POWER']) / 100).toFixed(2) + 'V');
	$('.info .txcontent .right .right_rval').html((parseInt(info['R_POWER']) / 100).toFixed(2) + 'V');
    } else
    if (device_type == "EDS GeX") {
        $('.info .gxcontent .left .left_rver').html(info['H_Ver']);
	if (b == 'percent') {
	    $('.info .gxcontent').attr('type', 'percent');

	    $('.info .gxcontent .left .left_rval').html(percentage(info['H_POWER']) + '%');
	} else {
	    $('.info .gxcontent').attr('type', 'volts');

	    $('.info .gxcontent .left .left_rval').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');

	    if (b == null) _setItem('battery', 'volts');
	}

	$('.info .gxcontent .right .right_lver').html(info['L_Ver']);
	$('.info .gxcontent .right .right_rver').html(info['R_Ver']);
	$('.info .gxcontent .right .right_lval').html((parseInt(info['L_POWER']) / 100).toFixed(2) + 'V');
	$('.info .gxcontent .right .right_rval').html((parseInt(info['R_POWER']) / 100).toFixed(2) + 'V');
    }

    // V/%
    $('.info .content').off('click').on('click', function() {
	//$('.info .content .left .left_ver').html(info['GEARS_V']);
	if ($(this).attr('type') == 'volts') {
	    $('.info .content .left .left_val').html(percentage(parseInt(info['POWER_2'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .content .left .left_val').html((parseInt(info['POWER_2']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	_setItem('battery', $(this).attr('type'));
    });
    $('.info .ox2content').off('click').on('click', function() {
	//$('.info .content .left .left_ver').html(info['GEARS_V']);
	if ($(this).attr('type') == 'volts') {
	    $('.info .ox2content .left .left_val').html(percentage(parseInt(info['H_POWER'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .ox2content .left .left_val').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	_setItem('battery', $(this).attr('type'));
    });
    $('.info .txcontent').off('click').on('click', function() {
	if ($(this).attr('type') == 'volts') {
	    $('.info .txcontent .left .left_fval').html(percentage(parseInt(info['Q_POWER'])) + '%');
	    $('.info .txcontent .left .left_rval').html(percentage(parseInt(info['H_POWER'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .txcontent .left .left_fval').html((parseInt(info['Q_POWER']) / 100).toFixed(2) + 'V');
	    $('.info .txcontent .left .left_rval').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	_setItem('battery', $(this).attr('type'));
    });
    $('.info .gxcontent').off('click').on('click', function() {
	if ($(this).attr('type') == 'volts') {
	    $('.info .gxcontent .left .left_rval').html(percentage(parseInt(info['H_POWER'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .gxcontent .left .left_rval').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	_setItem('battery', $(this).attr('type'));
    });
}

function crc16(payload)
{
    var CRC8Table = [ 0, 94, 188, 226, 97, 63, 221, 131, 194, 156, 126, 32, 163, 253, 31, 65, 157, 195, 33, 127, 252, 162, 64, 30, 95, 1, 227, 189, 62, 96, 130, 220, 35, 125, 159, 193, 66, 28, 254, 160, 225, 191, 93, 3, 128, 222, 60, 98, 190, 224, 2, 92, 223, 129, 99, 61, 124, 34, 192, 158, 29, 67, 161, 255, 70, 24, 250, 164, 39, 121, 155, 197, 132, 218, 56, 102, 229, 187, 89, 7, 219, 133, 103, 57, 186, 228, 6, 88, 25, 71, 165, 251, 120, 38, 196, 154, 101, 59, 217, 135, 4, 90, 184, 230, 167, 249, 27, 69, 198, 152, 122, 36, 248, 166, 68, 26, 153, 199, 37, 123, 58, 100, 134, 216, 91, 5, 231, 185, 140, 210, 48, 110, 237, 179, 81, 15, 78, 16, 242, 172, 47, 113, 147, 205, 17, 79, 173, 243, 112, 46, 204, 146, 211, 141, 111, 49, 178, 236, 14, 80, 175, 241, 19, 77, 206, 144, 114, 44, 109, 51, 209, 143, 12, 82, 176, 238, 50, 108, 142, 208, 83, 13, 239, 177, 240, 174, 76, 18, 145, 207, 45, 115, 202, 148, 118, 40, 171, 245, 23, 73, 8, 86, 180, 234, 105, 55, 213, 139, 87, 9, 235, 181, 54, 104, 138, 212, 149, 203, 41, 119, 244, 170, 72, 22, 233, 183, 85, 11, 136, 214, 52, 106, 43, 117, 151, 201, 74, 20, 246, 168, 116, 42, 200, 150, 21, 75, 169, 247, 182, 232, 10, 84, 215, 137, 107, 53 ];
    var t_crc16_h = [ 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64, 0, -63, -127, 64, 1, -64, -128, 65, 0, -63, -127, 64, 1, -64, -128, 65, 1, -64, -128, 65, 0, -63, -127, 64 ];
    var t_crc16_l = [ 0, -64, -63, 1, -61, 3, 2, -62, -58, 6, 7, -57, 5, -59, -60, 4, -52, 12, 13, -51, 15, -49, -50, 14, 10, -54, -53, 11, -55, 9, 8, -56, -40, 24, 25, -39, 27, -37, -38, 26, 30, -34, -33, 31, -35, 29, 28, -36, 20, -44, -43, 21, -41, 23, 22, -42, -46, 18, 19, -45, 17, -47, -48, 16, -16, 48, 49, -15, 51, -13, -14, 50, 54, -10, -9, 55, -11, 53, 52, -12, 60, -4, -3, 61, -1, 63, 62, -2, -6, 58, 59, -5, 57, -7, -8, 56, 40, -24, -23, 41, -21, 43, 42, -22, -18, 46, 47, -17, 45, -19, -20, 44, -28, 36, 37, -27, 39, -25, -26, 38, 34, -30, -29, 35, -31, 33, 32, -32, -96, 96, 97, -95, 99, -93, -94, 98, 102, -90, -89, 103, -91, 101, 100, -92, 108, -84, -83, 109, -81, 111, 110, -82, -86, 106, 107, -85, 105, -87, -88, 104, 120, -72, -71, 121, -69, 123, 122, -70, -66, 126, 127, -65, 125, -67, -68, 124, -76, 116, 117, -75, 119, -73, -74, 118, 114, -78, -77, 115, -79, 113, 112, -80, 80, -112, -111, 81, -109, 83, 82, -110, -106, 86, 87, -105, 85, -107, -108, 84, -100, 92, 93, -99, 95, -97, -98, 94, 90, -102, -101, 91, -103, 89, 88, -104, -120, 72, 73, -119, 75, -117, -118, 74, 78, -114, -113, 79, -115, 77, 76, -116, 68, -124, -123, 69, -121, 71, 70, -122, -126, 66, 67, -125, 65, -127, -128, 64 ];

    var vars = new Uint8Array(10);

    var i3 = 65535;
    var i4 = (65280 & i3) >> 8;
    var b = i3 & 255;
    var i5 = 0;
    while (i5 < payload.byteLength - 2) {
	var b2 = (b ^ payload[i5]) & 255; //payload[i + i5]
	i5++;
	var b3 = i4 ^ t_crc16_h[b2];
	i4 = t_crc16_l[b2];
	b = b3;
    }

    var crc = ((i4 & 255) << 8) | (b & 255 & 65535);

    return crc;
}

function setCRC16(payload)
{
    var crc = crc16(payload);

    var crc2 = (crc & 0xFF);
    var crc1 = ((crc >> 8) & 0xFF);
    payload[payload.byteLength - 2] = crc1;
    payload[payload.byteLength - 1] = crc2;

    return payload;
}

function detectDoubleTap(doubleTapMs)
{
    let timeout, lastTap = 0

    return function detectDoubleTap(event)
    {
	const currentTime = new Date().getTime()
	const tapLength = currentTime - lastTap
	if (0 < tapLength && tapLength < doubleTapMs) {
	    event.preventDefault()
	    const doubleTap = new CustomEvent("doubletap", {
		bubbles: true,
		detail: event
	    })
	    event.target.dispatchEvent(doubleTap)
	} else {
	    timeout = setTimeout(() => clearTimeout(timeout), doubleTapMs)
	}
	lastTap = currentTime
    }
}

function _raceMode(f)
{
    startBlock(lang['L_RACE_MODE'].replace("%s", (f == 1 ? lang["L_RACE_MODE_ON"] : lang['L_RACE_MODE_OFF'])));

    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setProtectionThreshold, 0x01, f, 0x00, 0x00 ]);
    a = setCRC16(a);
    characteristic_TX.writeValueWithoutResponse(a);
    log("Send: setProtectionThreshold");

    ctimeout = setTimeout(timeoutCheck, 1000);
}

function _sleepMode(f)
{
    startBlock(lang['L_SLEP_MODE'].replace("%s", (f == 0 ? lang["L_SLEEP_MODE_ON"] : lang['L_SLEEP_MODE_OFF'])));

    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_backDialSleep, 0x01, f, 0x00, 0x00 ]);
    a = setCRC16(a);
    characteristic_TX.writeValueWithoutResponse(a);
    log("Send: backDialSleep -> " + f.toString(16).padStart(2, '0'));

    ctimeout = setTimeout(timeoutCheck, 1000);
}

function _protectMode(f)
{
    startBlock(lang['L_RD_PROTECT_MODE'].replace("%s", (f == 0 ? lang['L_RD_PROTECT_OFF'] : lang['L_RD_PROTECT_ON'])));

    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_backSetting2p, 0x08, f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 ]);
    a = setCRC16(a);
    characteristic_TX.writeValueWithoutResponse(a);
    log("Send: backSetting2p -> " + f.toString(16).padStart(2, '0'));

    ctimeout = setTimeout(timeoutCheck, 1000);
}

function error(s)
{
    $('.error').html(s).fadeIn();

    setTimeout(function() {
        $('.error').fadeOut();
    }, 1500);
}

function qalert(s, close = 1)
{
    $('.qalert').html(s).fadeIn();

    clearTimeout(qtimeout);
    if (close) {
	qtimeout = setTimeout(function() {
	    $('.qalert').fadeOut();
	}, 1500);
    }
}

function startBlock(s = "", close = 1)
{
    if (s != "") qalert(s, close);
    $('.dim').show();
}
function endBlock()
{
    $('.qalert').hide();
    $('.dim').hide();
}

function closePopup(popup)
{
    $('#dim').hide();
    $('.popup').hide();
    $('body').unbind('mousewheel DOMMouseScroll touchmove');
}

function showPopup(popup)
{
    $('#dim').show();
    $('#' + popup + '_popup').show();

    $('body').bind('mousewheel DOMMouseScroll touchmove', function(e) {
       e.preventDefault();
    });
}

function _dialog(msg)
{
    closePopup();

    $('#dialog_popup .text').html(msg);
    $('#dialog_popup .fields').hide();;

    if ((arguments[1] != undefined) && (arguments[1] != null) && (arguments[1] != '')) {
       $('#dialog_popup .fields').html(arguments[1]).show();
    }
    if ((arguments[2] != undefined) && (arguments[2] != null)) {
       $('#dialog_popup .dcancel').off('click').on('click', arguments[2]);
    }
    if ((arguments[3] != undefined) && (arguments[3] != null)) {
       $('#dialog_popup .dok').off('click').on('click', arguments[3]);
    }

    showPopup('dialog');

    $('#dialog_popup .in input').first().focus();
}


$(document).ready(function() {
    var bt_supported = 0;

    if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register("/sw.js");
    }

    // switch language if not en
    if (locale.language != "en") {
	$('head').append('<link rel="stylesheet" type="text/css" href="/lang/' + locale.language + '.css">');
	$('head').append('<script src="lang/' + locale.language + '.js"></script>');
    }
    // translate
    $('span[lang], option[lang]').each(function() {
	$(this).html(lang[$(this).attr('lang')]);
    });

    try {
	var z = JSON.parse(_getItem('zoom'));
	document.documentElement.style.setProperty('--font-size-info', z.info);
	document.documentElement.style.setProperty('--font-size-live', z.live);
	document.documentElement.style.setProperty('--font-size-settings', z.settings);
    } catch(error) {
	;;;
    }

    if (parseInt(_getItem('lock')) == 1) {
	screen.orientation.lock("portrait");
	$('.menus .bmenus .button_lock_screen').addClass('selected');
    }

    if (navigator.bluetooth == null) {
	broadcast.postMessage({
	    type: 'VERSION',
	});
	/*broadcast.postMessage({
	    type: 'CACHE',
	});*/
	log('Sorry, no web bluetooth support');
	log('Try to install Chrome browser on your device first and try this app again');
	log('Running on: ' + navigator.userAgent + ' | ' + navigator.appCodeName + ' | ' + navigator.appName + ' | ' + navigator.appVersion + ' | ' + navigator.platform);
	return;
    }
    navigator.bluetooth.getAvailability().then((available) => {
	if (!available) {
	    broadcast.postMessage({
		type: 'VERSION',
	    });
	    log('Seems there is web bluetooth support, but it is not enabled');
	    log('Google Chrome: open chrome://flags and enable web bluetooth support');
	    log('Brave: open brave://flags and enable web bluetooth support');
	    log('Vivaldi: open vivaldi://flags and enable web bluetooth support');
	    log('Running on: ' + navigator.userAgent + ' | ' + navigator.appCodeName + ' | ' + navigator.appName + ' | ' + navigator.appVersion + ' | ' + navigator.platform);
	    return;
	}
    });

    show_debug = _getItem('show_debug');
    // set show_debug by default
    if (show_debug == null) show_debug = 0;
    if (show_debug == 1) {
	$('.debug').html(debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
	$('body').addClass('logs');
	$('.button_debug').addClass('selected');
    } else {
	$('.debug').hide();
	$('body').removeClass('logs');
	$('.button_debug').removeClass('selected');
    }

    document.addEventListener('pointerup', detectDoubleTap(500));

    // scan
    $('.scan .button.edsscan').on('click', function() {
	navigator.bluetooth.requestDevice({ filters: [{ namePrefix: ['EDS'] }], optionalServices: [ "6e400001-b5a3-f393-e0a9-e50e24dcca9e" ] })
	.then(device => {
	    device_type = device.name;
	    setup();
	    startBlock(lang['L_CONNECTED'] + ' ' + device_type);
	    $('.scan').hide();

	    broadcast.postMessage({
		type: 'VERSION',
	    });
	    log('Running on: ' + navigator.userAgent + ' | ' + navigator.appCodeName + ' | ' + navigator.appName + ' | ' + navigator.appVersion + ' | ' + navigator.platform);
	    log('Detected language: ' + locale.language);
	    log('Connected to ' + device_type);

	    dev = device;

	    device.addEventListener('gattserverdisconnected', onDisconnect);

	    return device.gatt.connect();
	})
	.then(server => server.getPrimaryServices())
	.then(services => {
	    let queue = Promise.resolve();
	    services.forEach(service => {
		log('Service: ' + service.uuid);
		queue = queue.then(_ => service.getCharacteristics().then(characteristics => {
		    log('Characteristics...');
		    characteristics.forEach(characteristic => {
			log('Characteristic: ' + characteristic.uuid + ' ' + getSupportedProperties(characteristic));
			if (characteristic.uuid == "6e400003-b5a3-f393-e0a9-e50e24dcca9e") {
			    characteristic.startNotifications();
			    characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
			    log('Listening for notifications ...');
			} else
			if (characteristic.uuid == "6e400002-b5a3-f393-e0a9-e50e24dcca9e") {
			    characteristic_TX = characteristic;
			}
		    });
		    // give it some time
		    var timeout = 500;
		    setTimeout(function() {
			startBlock(lang['L_GET_KEY']);

			// getKey
			var a = new Uint8Array([ 0xfe, 0x32, 0x29, cmd_getKey, 0x08, 0x79, 0x4f, 0x54, 0x6d, 0x4b, 0x35 ,0x30, 0x7a, 0x00, 0x00 ]);
			a = setCRC16(a);
			characteristic_TX.writeValueWithoutResponse(a);
			log("Send: getKey");
		    }, timeout);
		}));
	    });
	    return queue;
	})
	.catch(error => { console.error(error); });
    });

    // shift up
    $('.settings .action_buttons .button.up, .ox2settings .action_buttons .button.up, .txsettings .action_buttons .button.up, .gxsettings .action_buttons .button.up, .live .action_buttons .button.up').on('click', function() {
	qalert(lang['L_UP_SHIFT']);

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: rearLifting -> " + f.toString(16).padStart(2, '0'));
    });
    // shift down
    $('.settings .action_buttons .button.down, .ox2settings .action_buttons .button.down, .txsettings .action_buttons .button.down, .gxsettings .action_buttons .button.down, .live .action_buttons .button.down').on('click', function() {
	qalert(lang['L_DOWN_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: rearLifting -> " + f.toString(16).padStart(2, '0'));
    });
    // front shift up
    $('.txsettings .front_buttons .button.up').on('click', function() {
	var c = parseInt($('.txsettings .front_buttons .button.gear').html());
	if (c == 1) {
	    startBlock(lang['L_FRONT_UP_SHIFT']);

	    var f = 0x01;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: frontLifting -> " + f.toString(16).padStart(2, '0'));
	}
    });
    // Front shift down
    $('.txsettings .front_buttons .button.down').on('click', function() {
	var c = parseInt($('.txsettings .front_buttons .button.gear').html());
	if (c == 2) {
	    startBlock(lang['L_FRONT_DOWN_SHIFT']);

	    var f = 0x02;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: frontLifting -> " + f.toString(16).padStart(2, '0'));
	}
    });
    // front shift alter
    $('.live .action_buttons .button.front').on('click', function() {
	var c = parseInt($('.txsettings .front_buttons .button.gear').html()) || 0;

        startBlock(lang['L_FRONT_SHIFT']);

	var f = c;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: frontLifting -> " + f.toString(16).padStart(2, '0'));
    });

    // number of gears
    $('.settings .action_buttons .button.gears select, .ox2settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select, .gxsettings .action_buttons .button.gears select').on('change', function() {
	var t = $(this).val();
	if (t < parseInt(info['NUM']) + 1) {
	    endBlock();
	    qalert(lang['L_ERROR_INVALID_NUMBER_OF_GEARS'], 0);

	    $('.settings .action_buttons .button.gears select').val(info['TOTAL_CNT']);
	} else {
	    startBlock("Change number of gears");
	    var f = t;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setTotalGear, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: setTotalGear -> " + f.toString(16).padStart(2, '0'));

	    ctimeout = setTimeout(timeoutCheck, 1000);
	}
    });

    // micro shift up
    $('.settings .micro .up, .ox2settings .micro .up, .txsettings .micro .up, .gxsettings .micro .up').on('click', function() {
	qalert(lang['L_UP_MICRO_SHIFT']);

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16).padStart(2, '0'));
    });
    // micro shift down
    $('.settings .micro .down, .ox2settings .micro .down, .txsettings .micro .down, .gxsettings .micro .down').on('click', function() {
	qalert(lang['L_DOWN_MICRO_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16).padStart(2, '0'));
    });
    // front micro shift up
    $('.txsettings .front_micro .up').on('click', function() {
	qalert(lang['L_FRONT_UP_MICRO_SHIFT']);

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16).padStart(2, '0'));
    });
    // front micro shift down
    $('.txsettings .front_micro .down').on('click', function() {
	qalert(lang['L_FRONT_DOWN_MICRO_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16).padStart(2, '0'));
    });

    // set all gear values
    $('.settings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	all_gears = [];
	$('.settings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of all_gears
	var v = all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.ox2settings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	all_gears = [];
	$('.ox2settings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of all_gears
	var v = all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	all_gears = [];
	$('.txsettings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of all_gears
	var v = all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.gxsettings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	all_gears = [];
	$('.gxsettings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of all_gears
	var v = all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    // set all front limits
    $('.txsettings .gear_values .fvcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_LIMITS']);

	all_gears = [];
	$('.txsettings .gear_values .fvcontent .content input').each(function() {
	    var g = $(this).parent().attr('front');
	    var v = $(this).val();

	    all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of all_gears
	var v = all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setFrontGearLimit, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setFrontGearLimit -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });

    // on/off force gear switch on value set
    $('.settings .gear_values .vcontent .button.set_move, .ox2settings .gear_values .vcontent .button.set_move, .txsettings .gear_values .vcontent .button.set_move, .gxsettings .gear_values .vcontent .button.set_move').on('click', function() {
	var p = $(this);
	if ($(this).hasClass('selected'))
	    $(this).removeClass('selected');
	else
           _dialog(lang['L_CONFIRM_SET_MOVE'], '', function(e) {
               e.preventDefault();
               closePopup();
           }, function(e) {
               e.preventDefault();
               $(p).addClass('selected');
               closePopup();
           });
	    /*if (confirm(lang['L_CONFIRM_SET_MOVE']))
		$(this).addClass('selected');*/
    });

    // save as gear values
    $('.gear_values .button.save').on('click', function() {

	//var n = prompt(lang['L_PROMPT_NAME_PRESET']);

	_dialog(lang['L_PROMPT_NAME_PRESET'], '', function(e) {
	    e.preventDefault();
            closePopup();
        }, function(e) {
	    e.preventDefault();
	    var n = $('#dialog_popup .in .text input.preset').val();
            closePopup();

	    if ((n != null) && (n != "")) {
		var s = _getItem('gears');
		if (s == null) s = {}; else s = JSON.parse(s);
		if (s[device_type] == null) s[device_type] = {};

		s[device_type][n] = {};

	        var r = [];
		var pr = "";
		if (device_type == "EDS TX") {
		    pr = "tx";
		    $('.txsettings .gear_values .fvcontent input').each(function() {
			var g = $(this).parent().attr('front');
			var v = $(this).val();

			r.push({
			    'gear': g,
			    'value': v
			});
		    });
		    s[device_type][n]['front'] = r;
		}
		if (device_type == "EDS GeX") pr = "gx";
		if (device_type == "EDS OX2") pr = "ox2";

		r = [];
		$('.' + pr + 'settings .gear_values .vcontent input').each(function() {
		    var g = $(this).parent().attr('gear');
		    var v = $(this).val();

		    r.push({
			'gear': g,
			'value': v
		    });
		});
		s[device_type][n]['rear'] = r;

		_setItem('gears', JSON.stringify(s));

		buildPresets();
	    }
	});
    });

    // export
    $('.button_export').on('click', function() {
	$('.button_menu').trigger('click');
	var d = new Date();
	var fname = 'drEDS-' +
	    d.getFullYear() +
	    (d.getMonth() + 1).toString().padStart(2, 0) +
	    d.getDate().toString().padStart(2, 0) +
	    d.getHours().toString().padStart(2, 0) +
	    d.getMinutes().toString().padStart(2, 0) +
	    d.getSeconds().toString().padStart(2, 0) +
	    '.json';

	_dialog(lang['L_PROMPT_SAVE_PRESET'].replace('%s', fname), '', function(e) {
	    e.preventDefault();
	    closePopup();
	}, function(e) {
	    e.preventDefault();
	    closePopup();

	    var exp = {
		'debug': $('.button_debug').hasClass('selected'),
		'page': $('.button_page').hasClass('icon-wrench') ? "live" : "settings",
		'battery': _getItem('battery'),
		'lock': _getItem('lock'),
		'current': {
		    'device': device_type,
		    'rear': []
		}
	    };
	    var pr = "";
	    if (device_type == "EDS TX") {
		pr = "tx";
		exp.current.front = [];
	    }
	    if (device_type == "EDS GeX") pr = "gx";
	    if (device_type == "EDS OX2") pr = "ox2";
	    $('.' + pr + 'settings .gear_values .vcontent input').each(function() {
		var g = $(this).parent().attr('gear');
		var v = $(this).val();

		exp.current.rear.push({
		    'gear': g,
		    'value': v
		});
	    });
	    $('.' + pr + 'settings .gear_values .fvcontent input').each(function() {
		var g = $(this).parent().attr('front');
		var v = $(this).val();

		exp.current.front.push({
		    'gear': g,
		    'value': v
		});
	    });

	    var gears = _getItem('gears');
	    if (gears != null)
		exp.gears = JSON.parse(gears);

	    var json = JSON.stringify(exp);
	    var blob = new Blob([json], {type: "octet/stream"});
	    var url = window.URL.createObjectURL(blob);
	    var a = document.createElement("a");
	    a.href = url;
	    a.download = fname;
	    a.click();

	    qalert(lang['L_EXPORT_SUCCESS']);
	});

	/*if (confirm(lang['L_PROMPT_SAVE_PRESET'].replace('%s', fname))) {
	    var exp = {
		'debug': $('.button_debug').hasClass('selected'),
		'page': $('.button_page').hasClass('icon-wrench') ? "live" : "settings",
		'battery': _getItem('battery'),
		'lock': _getItem('lock'),
		'current': {
		    'device': device_type,
		    'rear': []
		}
	    };
	    var pr = "";
	    if (device_type == "EDS TX") {
		pr = "tx";
		exp.current.front = [];
	    }
	    if (device_type == "EDS GeX") pr = "gx";
	    if (device_type == "EDS OX2") pr = "ox2";
	    $('.' + pr + 'settings .gear_values .vcontent input').each(function() {
		var g = $(this).parent().attr('gear');
		var v = $(this).val();

		exp.current.rear.push({
		    'gear': g,
		    'value': v
		});
	    });
	    $('.' + pr + 'settings .gear_values .fvcontent input').each(function() {
		var g = $(this).parent().attr('front');
		var v = $(this).val();

		exp.current.front.push({
		    'gear': g,
		    'value': v
		});
	    });

	    var gears = _getItem('gears');
	    if (gears != null)
		exp.gears = JSON.parse(gears);

	    var json = JSON.stringify(exp);
	    var blob = new Blob([json], {type: "octet/stream"});
	    var url = window.URL.createObjectURL(blob);
	    var a = document.createElement("a");
	    a.href = url;
	    a.download = fname;
	    a.click();

	    qalert(lang['L_EXPORT_SUCCESS']);
	}*/
    });
    // import
    $('.button_import').on('click', function() {
	$('.button_menu').trigger('click');
	document.forms['uploadform'].elements['gearsfile'].onchange = function(evt) {
	    if (!window.FileReader) return;

	    var reader = new FileReader();
	    reader.onload = function(evt) {
		if (evt.target.readyState != 2) return;
		if (evt.target.error) {
		    qalert(lang['L_ERROR_READING_FILE']);
		    return;
		}

		filecontent = evt.target.result;

		var g = JSON.parse(filecontent);
		if (g != null) {
		    if (g.hasOwnProperty('debug'))
			if (g.debug) {
			    $('.debug').html(debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
			    $('body').addClass('logs');
			    $('.button_debug').addClass('selected');
			    _setItem('show_debug', 1);
			} else {
			    $('.debug').hide();
			    $('body').removeClass('logs');
			    $('.button_debug').removeClass('selected');
			    _setItem('show_debug', 0);
			}
		    if (g.hasOwnProperty('page'))
			if (g.page == "settings") {
			    if (device_type == "EDS OX")
				$('.settings').show();
			    else
			    if (device_type == "EDS OX2")
				$('.ox2settings').show();
			    else
			    if (device_type == "EDS TX")
				$('.txsettings').show();
			    else
			    if (device_type == "EDS GeX")
				$('.gxsettings').show();
			    $('.live').hide();
			    $('.info').removeClass('big');
			    $('.button_page').removeClass('icon-wrench').addClass('icon-bike');
			    _setItem('show_page', "settings");
			    show_page = "settings";
			} else {
			    $('.settings').hide();
			    $('.ox2settings').hide();
			    $('.txsettings').hide();
			    $('.gxsettings').hide();
			    $('.live').show();
			    $('.info').addClass('big');
			    $('.button_page').removeClass('icon-bike').addClass('icon-wrench');
			    _setItem('show_page', "live");
			    show_page = "live";
			}
		    if (g.hasOwnProperty('battery')) {
			_setItem('battery', g.battery);
			updateBattery();
		    }

		    if (g.hasOwnProperty('lock')) {
			_setItem('lock', g.lock);
			if (parseInt(g.lock) == 1) {
			    screen.orientation.lock("portrait");
			    $('.menus .bmenus .button_lock_screen').addClass('selected');
			}
		    }

		    if (g.hasOwnProperty('current')) {
			if (g.current.hasOwnProperty('device')) {
			    if (device_type == g.current.device) {
				var pr = "";
				if (device_type == "EDS TX") {
				    pr = "tx";
				    for (var t in g.current.front) {
					$('.' + pr + 'settings .gear_values .fvcontent .front[front="' + g.current.front[t].gear + '"] input').val(g.current.front[t].value);
				    }
				}
				if (device_type == "EDS GeX") pr = "gx";
				if (device_type == "EDS OX2") pr = "ox2";
				for (var t in g.current.rear) {
				    $('.' + pr + 'settings .gear_values .vcontent .gear[gear="' + g.current.rear[t].gear + '"] input').val(g.current.rear[t].value);
				}
			    } else {
				qalert(lang['L_ERROR_CURRENT_VALUES_NOT_INPORTED']);
			    }
			}
		    }
		    if (g.hasOwnProperty('gears')) {
			_setItem('gears', JSON.stringify(g.gears));
		    }

		    buildPresets();

		    qalert(lang['L_IMPORT_SUCCESS']);
		}
		document.forms['uploadform'].reset();
	    }
	    reader.readAsText(evt.target.files[0]);
	}
	$('#uploadform #gearsfile').trigger('click');
    });

    // set buttons function
    $('.settings .buttons_function .vbutton').on('click', function() {
	if ($('.settings .buttons_function .vbutton:first-child').hasClass('up')) {
	    var f = 0x01;
	} else {
	    var f = 0x00;
	}

	startBlock((f == 0 ? lang['L_NORMAL_BUTTONS'] : lang['L_REVERSED_BUTTONS']));

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_switchFingerOrder, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f.toString(16).padStart(2, '0'));

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.ox2settings .buttons_function .vbutton').on('click', function() {
	if ($('.ox2settings .buttons_function .vbutton:first-child').hasClass('up')) {
	    var f1 = 0x02;
	    var f2 = 0x01;
	} else {
	    var f1 = 0x01;
	    var f2 = 0x02;
	}

	startBlock((f1 == 0x01 ? lang['L_NORMAL_BUTTONS'] : lang['L_REVERSED_BUTTONS']));

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_switchFingerOrder, 0x04, 0, f1, 0, f2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f.toString(16).padStart(2, '0'));

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .buttons_function select').on('change', function() {
	var f1 = $('.txsettings .buttons_function select[button="small"]').val();
	if (f1 == "up") f1 = 1;
	if (f1 == "down") f1 = 2;
	if (f1 == "front") f1 = 3;
	var f2 = $('.txsettings .buttons_function select[button="big"]').val();
	if (f2 == "up") f2 = 1;
	if (f2 == "down") f2 = 2;
	if (f2 == "front") f2 = 3;
	var f3 = $('.txsettings .buttons_function select[button="single"]').val();
	if (f3 == "up") f3 = 1;
	if (f3 == "down") f3 = 2;
	if (f3 == "front") f3 = 3;

	startBlock(lang['L_SET_BUTTON_COMMANDS']);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_switchFingerOrder, 0x03, f1, f2, f3, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.gxsettings .buttons_function select').on('change', function() {
	var f1 = $('.gxsettings .buttons_function select[button="small"]').val();
	if (f1 == "up") f1 = 1;
	if (f1 == "down") f1 = 2;
	var f2 = $('.gxsettings .buttons_function select[button="big"]').val();
	if (f2 == "up") f2 = 1;
	if (f2 == "down") f2 = 2;
	var f3 = $('.gxsettings .buttons_function select[button="single"]').val();
	if (f3 == "up") f3 = 1;
	if (f3 == "down") f3 = 2;

	startBlock(lang['L_SET_BUTTON_COMMANDS']);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_switchFingerOrder, 0x03, f1, f2, f3, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

	ctimeout = setTimeout(timeoutCheck, 1000);
    });

    // set race mode
    $('.settings .buttons_function .button.mode, .ox2settings .buttons_function .button.mode, .txsettings .buttons_function .button.mode, .gxsettings .buttons_function .button.mode').on('click', function() {
	var f = 2;
	if (!$(this).hasClass('selected')) f = 1;

	if (f == 2) _raceMode(f); else
	if (f == 1) {
	    _dialog(lang['L_WARNING_RACE_MODE'], '', function(e) {
		e.preventDefault();
		closePopup();
	    }, function(e) {
		e.preventDefault();
		closePopup();

		_raceMode(f);
	    });
	}

	/*if (
	    ((f == 1) && (confirm(lang['L_WARNING_RACE_MODE'])))
	    ||
	    (f == 2)
	) {
	}*/
    });

    // set sleep mode
    $('.ox2settings .buttons_function .button.sleep, .txsettings .buttons_function .button.sleep, .gxsettings .buttons_function .button.sleep').on('click', function() {
	var f = 1;
	if (!$(this).hasClass('selected')) f = 0;

	if (f == 0) _sleepMode(f); else 
	if (f == 1) {
	    _dialog(lang['L_WARNING_SLEEP_MODE'], '', function(e) {
		e.preventDefault();
		closePopup();
	    }, function(e) {
		e.preventDefault();
		closePopup();

		_sleepMode(f);
	    });
	}

	/*if (
	    ((f == 1) && (confirm(lang['L_WARNING_SLEEP_MODE'])))
	    ||
	    (f == 0)
	) {
	}*/
    });

    // set RD protection
    $('.txsettings .buttons_function .button.rdprotect').on('click', function() {
	var f = 1;
	if ($(this).hasClass('selected')) f = 0;

	if (f == 0) _protectMode(f); else 
	if (f == 1) {
	    _dialog(lang['L_WARNING_RD_PROTECT'], '', function(e) {
		e.preventDefault();
		closePopup();
	    }, function(e) {
		e.preventDefault();
		closePopup();

		_protectMode(f);
	    });
	}

	/*if (
	    ((f == 0) && (confirm(lang['L_WARNING_RD_PROTECT'])))
	    ||
	    (f == 1)
	) {
	}*/
    });

    // debug
    $('.button_debug').on('click', function() {
	if ($(this).hasClass('selected')) {
	    $('.debug').hide();
	    $('body').removeClass('logs');
	    $(this).removeClass('selected');
	    _setItem('show_debug', 0);
	    $('.button_menu').trigger('click');
	} else {
	    $('.debug').html(debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
	    $('body').addClass('logs');
	    $(this).addClass('selected');
	    _setItem('show_debug', 1);
	    $('.button_menu').trigger('click');
	}
    });

    // menu
    $('.button_menu').on('click', function() {
	if ($(this).hasClass('selected')) {
	    $('.menus .bmenus').hide();
	    $(this).removeClass('selected');
	} else {
	    $('.menus .bmenus').show();
	    $(this).addClass('selected');
	}
    });

    // switch live / settings page
    $('.button_page').on('click', function() {
	if ($(this).hasClass('icon-wrench')) {
	    if (device_type == "EDS OX")
		$('.settings').show();
	    else
	    if (device_type == "EDS OX2")
		$('.ox2settings').show();
	    else
	    if (device_type == "EDS TX")
		$('.txsettings').show();
	    else
	    if (device_type == "EDS GeX")
		$('.gxsettings').show();
	    $('.live').hide();
	    $('.info').removeClass('big');
	    $(this).removeClass('icon-wrench').addClass('icon-bike');
	    _setItem('show_page', 'settings');
	    show_page = "settings";
	    $('.button_menu').trigger('click');
	} else {
	    $('.settings').hide();
	    $('.ox2settings').hide();
	    $('.txsettings').hide();
	    $('.gxsettings').hide();
	    $('.live').show();
	    $('.info').addClass('big');
	    $(this).removeClass('icon-bike').addClass('icon-wrench');
	    _setItem('show_page', 'live');
	    show_page = "live";
	    $('.button_menu').trigger('click');
	}
    });

    // shutdown
    $('.button_shutdown').on('click', function() {
	_dialog(lang['L_CONFIRM_SHUTDOWN'] + ' ' + device_type + '?', '', function(e) {
	    e.preventDefault();
	    closePopup();
	}, function(e) {
	    e.preventDefault();

	    qalert(lang['L_SHUTDOWN']);

	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_shutdown, 0x00, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: shutdown");

	    $('.button_menu').removeClass('selected');
	    $('.bmenus').hide();

	    dev.gatt.disconnect();

	    closePopup();
	});

	/*if (confirm(lang['L_CONFIRM_SHUTDOWN'] + ' ' + device_type + '?')) {
	    qalert(lang['L_SHUTDOWN']);

	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_shutdown, 0x00, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: shutdown");

	    $('.button_menu').removeClass('selected');
	    $('.bmenus').hide();

	    dev.gatt.disconnect();
	}*/
    });

    // disconnect
    $('.button_disconnect').on('click', function() {
	qalert(lang['L_DICSONNECTED']);

	$('.button_menu').removeClass('selected');
	$('.bmenus').hide();

	dev.gatt.disconnect();
    });

    // zoom
    $('.button_zoom_in').on('click', function() {
	try {
	    var z = JSON.parse(_getItem('zoom'));
	} catch(error) {
	    z = {
		'info': '0.8em',
		'live': '1em',
		'settings': '1em'
	    };
	}
	//var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-info").replace('em', ''));
	//a = a - 0.05;
	//document.documentElement.style.setProperty('--font-size-info', a + 'em');
	//z.info = a + 'em';
	if (show_page == "live") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-live").replace('em', ''));
	    a = a - 0.05;
	    document.documentElement.style.setProperty('--font-size-live', a + 'em');
	    z.live = a + 'em';
	} else
	if (show_page == "settings") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-settings").replace('em', ''));
	    a = a - 0.05;
	    document.documentElement.style.setProperty('--font-size-settings', a + 'em');
	    z.settings = a + 'em';
	}
	_setItem('zoom', JSON.stringify(z));
    });
    $('.button_zoom_out').on('click', function() {
	try {
	    z = JSON.parse(_getItem('zoom'));
	} catch(error) {
	    z = {
		'info': '0.8em',
		'live': '1em',
		'settings': '1em'
	    };
	}
	//var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-info").replace('em', ''));
	//a = a + 0.05;
	//document.documentElement.style.setProperty('--font-size-info', a + 'em');
	//z.info = a + 'em';
	if (show_page == "live") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-live").replace('em', ''));
	    a = a + 0.05;
	    document.documentElement.style.setProperty('--font-size-live', a + 'em');
	    z.live = a + 'em';
	} else
	if (show_page == "settings") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-settings").replace('em', ''));
	    a = a + 0.05;
	    document.documentElement.style.setProperty('--font-size-settings', a + 'em');
	    z.settings = a + 'em';
	}
	_setItem('zoom', JSON.stringify(z));
    });

    // lock screen orientation
    $('.button_lock_screen').on('click', function() {
	if ($(this).hasClass('selected')) {
	    $(this).removeClass('selected');

	    screen.orientation.unlock();
	    _setItem('lock', 0);
	} else {
	    $(this).addClass('selected');

	    screen.orientation.lock("portrait");
	    _setItem('lock', 1);
	}

	$('.button_menu').removeClass('selected');
	$('.bmenus').hide();
    });

    // copy to clipboard
    document.querySelector('.debug').addEventListener('doubletap', (event) => {
	var copyText = $('.debug')[0];

	// Select the text field
	copyText.select();
	copyText.setSelectionRange(0, 999999); // For mobile devices
	// next line do the same, but don't use it for now
	//copyText.setSelectionRange(0, -1); // For mobile devices

	if (copyText.value != "")
	{
	    // Copy the text inside the text field
	    navigator.clipboard.writeText(copyText.value);

	    copyText.setSelectionRange(0, 0);

	    qalert(lang['L_COPIED_TO_CLIPBOARD']);

	    _dialog(lang['L_CONFIRM_SEND_LOG'], '', function(e) {
		e.preventDefault();
		closePopup();
	    }, function(e) {
		e.preventDefault();

		$.ajax({
		    method: "POST",
		    url: "/upload.php",
		    data: { step: "allow" }
		}).done(function(response) {
		    var r = JSON.parse(response);
		    if (r.result == "OK") {
			$.ajax({
			    method: "POST",
			    url: "/upload.php",
			    data: { step: "put", hash: r.hash, log: copyText.value }
			}).done(function(response) {
			    qalert(lang['L_LOG_SENDED']);
			});
		    }
		});

		closePopup();
	    });
	    /*if (confirm(lang['L_CONFIRM_SEND_LOG'])) {
		$.ajax({
		    method: "POST",
		    url: "/upload.php",
		    data: { step: "allow" }
		}).done(function(response) {
		    var r = JSON.parse(response);
		    if (r.result == "OK") {
			$.ajax({
			    method: "POST",
			    url: "/upload.php",
			    data: { step: "put", hash: r.hash, log: copyText.value }
			}).done(function(response) {
			    qalert(lang['L_LOG_SENDED']);
			});
		    }
		});
	    }*/
	}
    });

    // hide qalert in click
    $('.qalert').on('click', function() {
        $(this).fadeOut();
    });
    });
