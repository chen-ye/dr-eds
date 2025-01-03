
/*
    TODO:
	1. firmware upgrade
	2. casual/performance mode
	3. buttons settings
*/

var debug = 1;
var show_debug = 1;
var show_page = 'settings';
var device_type = "";

const cmd_getKey = 0x11;
const cmd_getLockInfo = 0x31;
const cmd_getPowerInfo = 0x42;
const cmd_getFrontAndRearDerailleurGearValuesInfo = 0x61;
const cmd_backSetting = 0x67;
const cmd_setFrontGearLimit = 0x82;
const cmd_fineTuneFrontGear = 0x85;
const cmd_getDeviceMac = 0x86;
const cmd_frontStatusReport = 0x88;
const cmd_frontLifting = 0x89;
const cmd_shutdown = 0x90;
const cmd_setTotalGear = 0x91;
const cmd_setGearUpValue = 0x92;
const cmd_fineTuneGear = 0x95;
const cmd_getCurrentGear = 0x97;
const cmd_serverReportGear = 0x98;
const cmd_switchFingerOrder = 0x9c;
const cmd_rearLifting = 0x99;
const cmd_startRead = 0xfa;
const cmd_read = 0xfb;

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

function log(s, force)
{
    if (debug || force) {
	$('.debug').append(s.trim() + '\n');
	$('.debug').scrollTop($('.debug').prop("scrollHeight"));

	console.log(s.trim());
    }
}

function setup()
{
    $('.settings').hide();
    $('.txsettings').hide();
    $('.scan').show();
    $('.debug').html('');
    $('.info .content').hide();
    $('.info .txcontent').hide();
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
	s += value.getUint8(t) + ' ';
    }
    log("Received: " + s);

    var r = parsePacket(payload);

    if (r.ascii) return;

    if (r.cmd == cmd_getKey) {
	key = r.key;

	// start read all the data
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_startRead, 0x00, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: startRead");
    } else
    if (r.cmd == cmd_startRead) {
	blocks = r.payload[1];
	current_block = 0;

	startBlock("Getting information", 0);
	// let's read all the data
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_read, 0x03, 0x00, current_block, 0x51, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: read -> block " + current_block);
    } else
    if (r.cmd == cmd_rearLifting) {
	// shift from gear
	log("RD received rearLifting", 1);
    } else
    if (r.cmd == cmd_serverReportGear) {
	// shifted to gear
	var s = "";
	for (var t = 0; t < r.payload_length; t++)
	{
	    s += r.payload[t] + ' ';
	}
	log(s, 1);
	info['NUM'] = r.payload[4];
	var t = parseInt(r.payload[4]);
	t = parseInt(info['TOTAL_CNT']) - t + 1;
	if (r.payload[5] == 1)
	    log("RD start rearLifting to gear " + t, 1);
	else
	    log("RD finish rearLifting to gear " + t, 1);

	// show micro shift only on lowest gear
	var pr = "";
	if (device_type == "EDS TX") pr = "tx";
	if (info['NUM'] == 1)
	    $('.' + pr + 'settings .micro').show();
	else
	    $('.' + pr + 'settings .micro').hide();

	$('.settings .action_buttons .button.gear, .txsettings .action_buttons .button.gear').html(t);
	$('.settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select').val(parseInt(info['TOTAL_CNT']));//.change();
	$('.live .gear').html(t);
	$('.live .gears').html('/' + info['TOTAL_CNT']);
    } else
    if (r.cmd == cmd_frontStatusReport) {
	// shifted front
	var s = "";
	for (var t = 0; t < r.payload_length; t++)
	{
	    s += r.payload[t] + ' ';
	}
	log(s, 1);
	info['Q_NUM'] = r.payload[4];
	if ((info['Q_NUM'] == 1) || (info['Q_NUM'] == 2) || (info['Q_NUM'] == 3)) t = 1;
	if ((info['Q_NUM'] == 4) || (info['Q_NUM'] == 5) || (info['Q_NUM'] == 6)) t = 2;

	var pr = "";
	if (device_type == "EDS TX") pr = "tx";
	if (t == 1) {
	    // show micro shift only on lowest gear
	    $('.' + pr + 'settings .front_micro').show();
	} else {
	    $('.' + pr + 'settings .front_micro').hide();
	}

	log("FD frontLifting to gear " + t, 1);

	$('.txsettings .front_buttons .button.gear').html(t);
    } else
    if (r.cmd == cmd_switchFingerOrder) {
	// for some reason this always return 0 after change which may indicate OK,
	// but we ignore it - we just assume it switched buttons
	endBlock();
	if (r.payload[0] == 0x00) {
	    clearTimeout(ctimeout);

	    if ($('.settings .buttons_function .vbutton:first-child').html() == "Up") {
		var f = 0x01;
	    } else {
		var f = 0x00;
	    }
	    endBlock();
	    qalert((f == 0 ? "Normal buttons" : "Reversed buttons"));

	    if ($('.settings .buttons_function .vbutton:first-child').html() == "Up") {
		$('.settings .buttons_function .vbutton:first-child').html("Down");
		$('.settings .buttons_function .vbutton:last-child').html("Up");
	    } else {
		$('.settings .buttons_function .vbutton:first-child').html("Up");
		$('.settings .buttons_function .vbutton:last-child').html("Down");
	    }
	} else {
	    error('Command failed');
	}
    } else
    if (r.cmd == cmd_setTotalGear) {
	// for some reason this always return 0 after change which may indicate OK,
	// but we don't know actual gear values, so ...
	endBlock();
	if (r.payload[0] == 0x00) {
	    clearTimeout(ctimeout);
	    qalert("Changed number of gears");
	} else {
	    $('.settings .action_buttons .button.gears select').val(info['TOTAL_CNT']);

	    error('Command failed');
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
		log("Send: setGearUpValue -> " + v.gear.toString(16) + ' = ' + v.value);

		ctimeout = setTimeout(timeoutCheck, 1000);
	    } else {
		qalert("Updated gear value");
	    }
	} else {
	    error('Command failed');
	}
    } else
    if (r.cmd == cmd_setFrontGearLimit) {
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
		log("Send: setFrontGearLimit -> " + v.gear.toString(16) + ' = ' + v.value);

		ctimeout = setTimeout(timeoutCheck, 1000);
	    } else {
		qalert("Updated front gear value");
	    }
	} else {
	    error('Command failed');
	}
    } else
    if (r.cmd == cmd_frontStatusReport)
    {
        log("Received: frontStatusReport");
    } else
    if (r.cmd == cmd_getFrontAndRearDerailleurGearValuesInfo)
    {
        log("Received: getFrontAndRearDerailleurGearValuesInfo");

        var s = "FD:";
        for (var t = 0; t < r.payload_length; t = t + 1)
        {
	    s += ' ' + r.payload[t];
	}
	log(s);

	$('.txsettings .gear_values .fvcontent .content').html('');
	for (var t = 0; t < r.payload_length; t = t + 2) {
	    var v = r.payload[t] * 256;
	    v += r.payload[t + 1];
	    info['Q_GEA[' + ((t / 2) + 1) + ']'] = v;
	}
	info['Q_TOTAL'] = r.payload_length / 2;

	buildFrontValues();
	bindActionButtons();
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
	log("CRC: " + crc + " = " + crcc + " -> OK");
    } else {
	if (blocks == 0) {
	    log("CRC: " + crc + " != " + crcc + " -> FAILED");
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
	log("prefix: " + hex[0]);
	log("u8: " + u8);
	log("key: " + r.key);
	log("cmd: " + r.cmd);
	log("length: " + r.length);

	for (var t = 5; t < 5 + r.length; t++) {
		r.payload[t - 5] = hex[t] ^ u8;
		r.payload_length++;
	}
	var s = "";
	for (var t = 0; t < r.payload_length; t++) {
	    s += r.payload[t] + ' ';
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
	    if (device_type == "EDS TX")
		$('.txsettings').show();
	    $('.scan').hide();
	    $('.settings .micro').hide();
	    if (device_type == "EDS OX")
		$('.info .content').show();
	    else
	    if (device_type == "EDS TX")
		$('.info .txcontent').show();
	    $('.button_page').show();
	    $('.button_disconnect').show();
	    if (device_type == "EDS TX")
		$('.button_shutdown').show();
	    $('.button_export').show();
	    $('.button_import').show();

	    show_page = localStorage.getItem('show_page');
	    // set show_page by default
	    if (show_page == null) show_page = 'settings';
	    if (show_page == 'settings') {
		if (device_type == "EDS OX")
		    $('.settings').show();
		else
		if (device_type == "EDS TX")
		    $('.txsettings').show();
		$('.live').hide();
		$('.info').removeClass('big');
		$('.button_page').removeClass('icon-wrench').addClass('icon-bike');
	    } else {
		$('.settings').hide();
		$('.txsettings').hide();
		$('.live').show();
		$('.info').addClass('big');
		$('.button_page').removeClass('icon-bike').addClass('icon-wrench');
	    }

	    var t = parseInt(info['NUM']);
	    t = parseInt(info['TOTAL_CNT']) - t + 1;
	    $('.settings .action_buttons .button.gear, .txsettings .action_buttons .button.gear').html(t);
	    $('.settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select').val(parseInt(info['TOTAL_CNT']));//.change();
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
		    log("Send: getFrontAndRearDerailleurGearValuesInfo, -> " + f1.toString(16) + ' ' + f2.toString(16) + ' ' + f3.toString(16));
		}

		t = 1;
		if ((info['Q_NUM'] == 1) || (info['Q_NUM'] == 2) || (info['Q_NUM'] == 3)) t = 1;
		if ((info['Q_NUM'] == 4) || (info['Q_NUM'] == 5) || (info['Q_NUM'] == 6)) t = 2;
		$('.txsettings .front_buttons .button.gear').html(t);
	    }

	    var b = localStorage.getItem('battery');
	    if (device_type == "EDS OX") {
		$('.info .content .left .left_ver').html(info['GEARS_V']);
		if (b == 'percent') {
		    $('.info .content').attr('type', 'percent');
		    $('.info .content .left .left_val').html(percentage(info['POWER_2']) + '%');
		} else {
		    $('.info .content').attr('type', 'battery');
		    $('.info .content .left .left_val').html((parseInt(info['POWER_2']) / 100).toFixed(2) + 'V');
		}

		$('.info .content .right .right_ver').html(info['REMOTE_V']);
		$('.info .content .right .right_val').html((parseInt(info['POWER_1']) / 100).toFixed(2) + 'V');
	    } else
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

		    if (b == null) localStorage.setItem('battery', 'volts');
		}

		$('.info .txcontent .right .right_lver').html(info['L_Ver']);
		$('.info .txcontent .right .right_rver').html(info['R_Ver']);
		$('.info .txcontent .right .right_lval').html((parseInt(info['L_POWER']) / 100).toFixed(2) + 'V');
		$('.info .txcontent .right .right_rval').html((parseInt(info['R_POWER']) / 100).toFixed(2) + 'V');
	    }

	    if (device_type == "EDS OX") {
		$('.settings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.settings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="button minus">-</div><input type="text" value="' + parseInt(info['GEARS[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">Set</div></div>');
		}
	    } else
	    if (device_type == "EDS TX") {
		buildFrontValues();

		$('.txsettings .gear_values .vcontent .content').html('');
		for (var t = 0; t < parseInt(info['TOTAL_CNT']); t++) {
		    var r = parseInt(info['TOTAL_CNT']) - t;
		    $('.txsettings .gear_values .vcontent .content').append('<div class="gear" gear="' + (t + 1) + '"><div class="button minus">-</div><input type="text" value="' + parseInt(info['H_GEA[' + (t + 1) + ']']) + '"><div class="button plus gear' + r + '">+</div><div class="button set">Set</div></div>');
		}
	    }

	    // show micro shift only on lowest gear
	    var pr = "";
	    if (device_type == "EDS TX") pr = "tx";
	    if (info['NUM'] == 1)
		$('.' + pr + 'settings .micro').show();
	    else
		$('.' + pr + 'settings .micro').hide();

	    bindActionButtons();
	    buildPresets();

	    $('.settings .buttons_function .button').removeClass('selected');
	    if (parseInt(info['KeySwitch']) == 0) {
	    	$('.settings .buttons_function .vbutton.top').html('Up');
	    	$('.settings .buttons_function .vbutton.bottom').html('Down');
	    } else {
	    	$('.settings .buttons_function .vbutton.top').html('Down');
	    	$('.settings .buttons_function .vbutton.bottom').html('Up');
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
    error("Command failed");
}

function buildPresets()
{
    var gears = localStorage.getItem('gears');
    if (gears != null)
	gears = JSON.parse(gears);
    else
	gears = {};

    var s = '';
    for (var t in gears) {
	s += '<div class="preset_wrap"><div class="button preset" preset="' + t + '">' + t + '</div><div class="button del" preset="' + t + '">x</div></div>';
    }
    $('.settings .gear_values .presets').html(s);

    $('.settings .gear_values .presets .preset').off('click').on('click', function() {
	var a = localStorage.getItem('gears');
	a = JSON.parse(a);
	if (a != null) {
	    for (var t in a[$(this).attr('preset')])
	    {
		$('.settings .gear_values .vcontent .content .gear[gear="' + a[$(this).attr('preset')][t].gear + '"] input').val(a[$(this).attr('preset')][t].value);
	    }
	}

	qalert('Gear values loaded from preset "' + $(this).attr('preset') + '"<br />Click "Set all" to upload then to RD');
    });
    $('.settings .gear_values .presets .del').off('click').on('click', function() {
	var pname =  $(this).attr('preset');
	if (confirm('Delete preset "' + pname + '"?')) {
	    var a = localStorage.getItem('gears');
	    a = JSON.parse(a);
	    if (a != null) {
		delete a[$(this).attr('preset')];
	    }
	    localStorage.setItem('gears', JSON.stringify(a));

	    buildPresets();

	    qalert('Preset "' + pname + '" deleted');
	}
    });
}

function buildFrontValues()
{
    $('.txsettings .gear_values .fvcontent .content').html('');
    for (var t = 1; t <= parseInt(info['Q_TOTAL']); t++) {
        $('.txsettings .gear_values .fvcontent .content').append('<div class="front" front="' + t + '"><div class="button minus">-</div><input type="text" value="' + parseInt(info['Q_GEA[' + t + ']']) + '"><div class="button plus front' + t + '">+</div><div class="button set">Set</div></div>');
    }
}

function bindActionButtons()
{
    // set gear values
    $('.settings .gear_values .vcontent .content .button.minus, .txsettings .gear_values .vcontent .content .button.minus, .txsettings .gear_values .fvcontent .content .button.minus').off('click').on('click', function() {
	var v = $(this).next().val();
	if (v > 0) v--;
	$(this).next().val(v);
    });
    $('.settings .gear_values .vcontent .content .button.plus, .txsettings .gear_values .vcontent .content .button.plus, .txsettings .gear_values .fvcontent .content .button.plus').off('click').on('click', function() {
	var v = $(this).prev().val();
	v++;
	$(this).prev().val(v);
    });
    $('.settings .gear_values .vcontent .content .button.set, .txsettings .gear_values .vcontent .content .button.set').off('click').on('click', function() {
	startBlock("Update gear value");

	var g = $(this).parent().attr('gear');
	var v = $(this).prev().prev().val();

	var v2 = (v & 0xFF);
	var v1 = ((v >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setGearUpValue, 0x03, g, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + g.toString(16) + ' = ' + v);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .gear_values .fvcontent .content .button.set').off('click').on('click', function() {
	startBlock("Update front gear value");

	var g = $(this).parent().attr('front');
	var v = $(this).prev().prev().val();

	var v2 = (v & 0xFF);
	var v1 = ((v >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setFrontGearLimit, 0x03, g, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setFrontGearLimit -> " + g.toString(16) + ' = ' + v);

	ctimeout = setTimeout(timeoutCheck, 1000);
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

$(document).ready(function() {
    var bt_supported = 0;

    if (navigator.bluetooth == null) {
	log('Sorry, no web bluetooth support');
	log('Try to install Chrome browser on your device first and try this app again');
	return;
    }
    navigator.bluetooth.getAvailability().then((available) => {
	if (!available) {
	    log('Seems there is web bluetooth support, but it is not enabled');
	    log('Google Chrome: open chrome://flags and enable web bluetooth support');
	    log('Brave: open brave://flags and enable web bluetooth support');
	    log('Vivaldi: open vivaldi://flags and enable web bluetooth support');
	    return;
	}
    });

    show_debug = localStorage.getItem('show_debug');
    // set show_debug by default
    if (show_debug == null) show_debug = 1;
    if (show_debug == 1) {
	$('.debug').show();
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
	    startBlock("Connected to " + device_type);
	    $('.scan').hide();

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
			startBlock("Get key");

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

    // V/%
    $('.info .content').on('click', function() {
	//$('.info .content .left .left_ver').html(info['GEARS_V']);
	if ($(this).attr('type') == 'volts') {
	    $('.info .content .left .left_val').html(percentage(parseInt(info['POWER_2'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .content .left .left_val').html((parseInt(info['POWER_2']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	localStorage.setItem('battery', $(this).attr('type'));
    });
    $('.info .txcontent').on('click', function() {
	if ($(this).attr('type') == 'volts') {
	    $('.info .txcontent .left .left_fval').html(percentage(parseInt(info['Q_POWER'])) + '%');
	    $('.info .txcontent .left .left_rval').html(percentage(parseInt(info['H_POWER'])) + '%');
	    $(this).attr('type', 'percent');
	} else {
	    $('.info .txcontent .left .left_fval').html((parseInt(info['Q_POWER']) / 100).toFixed(2) + 'V');
	    $('.info .txcontent .left .left_rval').html((parseInt(info['H_POWER']) / 100).toFixed(2) + 'V');
	    $(this).attr('type', 'volts');
	}
	localStorage.setItem('battery', $(this).attr('type'));
    });

    // shift up
    $('.settings .action_buttons .button.up, .txsettings .action_buttons .button.up, .live .action_buttons .button.up').on('click', function() {
	qalert("Up shift");

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: rearLifting -> " + f.toString(16));
    });
    // shift down
    $('.settings .action_buttons .button.down, .txsettings .action_buttons .button.down, .live .action_buttons .button.down').on('click', function() {
	qalert("Down shift");

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: rearLifting -> " + f.toString(16));
    });
    // front shift up
    $('.txsettings .front_buttons .button.up').on('click', function() {
	var c = parseInt($('.txsettings .front_buttons .button.gear').html());
	if (c == 1) {
	    qalert("Front Up shift");

	    var f = 0x01;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: frontLifting -> " + f.toString(16));
	}
    });
    // Front shift down
    $('.txsettings .front_buttons .button.down').on('click', function() {
	var c = parseInt($('.txsettings .front_buttons .button.gear').html());
	if (c == 2) {
	    qalert("Front Down shift");

	    var f = 0x02;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: frontLifting -> " + f.toString(16));
	}
    });

    // number of gears
    $('.settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select').on('change', function() {
	var t = $(this).val();
	if (t < parseInt(info['NUM']) + 1) {
	    endBlock();
	    qalert('Selected total number of gears is<br />less than current gear!<br /><br />Please, shift on gear less or<br />equal of total number of gears.', 0);

	    $('.settings .action_buttons .button.gears select').val(info['TOTAL_CNT']);
	} else {
	    startBlock("Change number of gears");
	    var f = t;
	    var a = new Uint8Array([ 0xfe, 0x32, key, cmd_setTotalGear, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: setTotalGear -> " + f.toString(16));

	    ctimeout = setTimeout(timeoutCheck, 1000);
	}
    });

    // micro shift up
    $('.settings .micro .up, .txsettings .micro .up').on('click', function() {
	qalert("Up micro shift");

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16));
    });
    // micro shift down
    $('.settings .micro .down, .txsettings .micro .down').on('click', function() {
	qalert("Down micro shift");

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16));
    });
    // front micro shift up
    $('.txsettings .front_micro .up').on('click', function() {
	qalert("Front Up micro shift");

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16));
    });
    // front micro shift down
    $('.txsettings .front_micro .down').on('click', function() {
	qalert("Front Down micro shift");

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16));
    });

    // set all gear values
    $('.settings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock("Update gears values");

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
	log("Send: setGearUpValue -> " + v.gear.toString(16) + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock("Update gears values");

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
	log("Send: setGearUpValue -> " + v.gear.toString(16) + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });
    // set all front limits
    $('.txsettings .gear_values .fvcontent .button.set_all').on('click', function() {
	startBlock("Update front gears values");

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
	log("Send: setFrontGearLimit -> " + v.gear.toString(16) + ' = ' + v.value);

	ctimeout = setTimeout(timeoutCheck, 1000);
    });

    // save as gear values
    $('.gear_values .button.save').on('click', function() {
	var n = prompt('Enter gear values preset name (only letters and numbers):');
	if ((n != null) && (n != "")) {
	    var s = localStorage.getItem('gears');
	    if (s == null) s = {}; else s = JSON.parse(s);

	    var r = [];
	    $('.gear_values .content input').each(function() {
		var g = $(this).parent().attr('gear');
		var v = $(this).val();

		r.push({
		    'gear': g,
		    'value': v
		});
	    });
	    s[n] = r;

	    localStorage.setItem('gears', JSON.stringify(s));

	    buildPresets();
	}
    });

    // export
    $('.button_export').on('click', function() {
	var d = new Date();
	var fname = 'drWtOX-gears-' +
	    d.getFullYear() +
	    (d.getMonth() + 1).toString().padStart(2, 0) +
	    d.getDate().toString().padStart(2, 0) +
	    d.getHours().toString().padStart(2, 0) +
	    d.getMinutes().toString().padStart(2, 0) +
	    d.getSeconds().toString().padStart(2, 0) +
	    '.json';

	if (confirm('Export settings, values and presets to file ' + fname + '?')) {
	    var exp = {
		'debug': $('.button_debug').hasClass('selected'),
		'page': $('.button_page').hasClass('icon-wrench') ? "settings" : "live",
		'battery': localStorage.getItem('battery'),
		'current': []
	    };
	    $('.gear_values .content input').each(function() {
		var g = $(this).parent().attr('gear');
		var v = $(this).val();

		exp.current.push({
		    'gear': g,
		    'value': v
		});
	    });

	    var gears = localStorage.getItem('gears');
	    if (gears != null)
		exp.gears = JSON.parse(gears);

	    var json = JSON.stringify(exp);
	    var blob = new Blob([json], {type: "octet/stream"});
	    var url = window.URL.createObjectURL(blob);
	    var a = document.createElement("a");
	    a.href = url;
	    a.download = fname;
	    a.click();

	    qalert('Values saved');
	}
    });
    // import
    $('.button_import').on('click', function() {
	document.forms['uploadform'].elements['gearsfile'].onchange = function(evt) {
	    if (!window.FileReader) return;

	    var reader = new FileReader();
	    reader.onload = function(evt) {
		if (evt.target.readyState != 2) return;
		if (evt.target.error) {
		    alert('Error while reading file');
		    return;
		}

		filecontent = evt.target.result;

		var g = JSON.parse(filecontent);
		if (g != null) {
		    if (g.hasOwnProperty('debug'))
			if (g.debug) {
			    $('.debug').show();
			    $('body').addClass('logs');
			    $('.button_debug').addClass('selected');
			    localStorage.setItem('show_debug', 1);
			} else {
			    $('.debug').hide();
			    $('body').removeClass('logs');
			    $('.button_debug').removeClass('selected');
			    localStorage.setItem('show_debug', 0);
			}
		    if (g.hasOwnProperty('page'))
			if (g.page == "settings") {
			    if (device_type == "EDS OX")
				$('.settings').show();
			    else
			    if (device_type == "EDS TX")
				$('.txsettings').show();
			    $('.live').hide();
			    $('.info').removeClass('big');
			    $('.button_page').removeClass('icon-wrench').addClass('icon-bike');
			    localStorage.setItem('show_page', "settings");
			} else {
			    $('.settings').hide();
			    $('.txsettings').hide();
			    $('.live').show();
			    $('.info').addClass('big');
			    $('.button_page').removeClass('icon-bike').addClass('icon-wrench');
			    localStorage.setItem('show_page', "live");
			}
		    if (g.hasOwnProperty('battery')) {
			$('.info .content .left .left_ver').html(info['GEARS_V']);
			if (g.battery == 'percent') {
			    $('.info .content .left .left_val').html(percentage(parseInt(info['POWER_2'])) + '%');
			    $('.info .content, .info .txcontent').attr('type', 'percent');
			} else {
			    $('.info .content .left .left_val').html((parseInt(info['POWER_2']) / 100).toFixed(2) + 'V');
			    $('.info .content, .info .txcontent').attr('type', 'volts');
			}
		    }

		    if (g.hasOwnProperty('current')) {
			for (var t in g.current) {
			    $('.settings .gear_values .content .gear[gear="' + g.current[t].gear + '"] input').val(g.current[t].value);
			}
		    }
		    if (g.hasOwnProperty('gears')) {
			localStorage.setItem('gears', JSON.stringify(g.gears));
		    }

		    buildPresets();

		    qalert('Settings, values and presets are restored');
		}
	    }
	    reader.readAsText(evt.target.files[0]);
	}
	$('#uploadform #gearsfile').trigger('click');
    });

    // set buttons function
    $('.settings .buttons_function .vbutton').on('click', function() {
	if ($('.settings .buttons_function .vbutton:first-child').html() == "Up") {
	    var f = 0x01;
	} else {
	    var f = 0x00;
	}

	startBlock((f == 0 ? "Normal buttons" : "Reversed buttons"));

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_switchFingerOrder, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f.toString(16));

	ctimeout = setTimeout(timeoutCheck, 1000);
    });

    // debug
    $('.button_debug').on('click', function() {
	if ($(this).hasClass('selected')) {
	    $('.debug').hide();
	    $('body').removeClass('logs');
	    $(this).removeClass('selected');
	    localStorage.setItem('show_debug', 0);
	} else {
	    $('.debug').show();
	    $('body').addClass('logs');
	    $(this).addClass('selected');
	    localStorage.setItem('show_debug', 1);
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
	    if (device_type == "EDS TX")
		$('.txsettings').show();
	    $('.live').hide();
	    $('.info').removeClass('big');
	    $(this).removeClass('icon-wrench').addClass('icon-bike');
	    localStorage.setItem('show_page', 'settings');
	} else {
	    $('.settings').hide();
	    $('.txsettings').hide();
	    $('.live').show();
	    $('.info').addClass('big');
	    $(this).removeClass('icon-bike').addClass('icon-wrench');
	    localStorage.setItem('show_page', 'live');
	}
    });

    // shutdown
    $('.button_shutdown').on('click', function() {
	qalert("Device shutdown");

	var a = new Uint8Array([ 0xfe, 0x32, key, cmd_shutdown, 0x00, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: shutdown");

	$('.bmenus').hide();

	dev.gatt.disconnect();
    });

    // disconnect
    $('.button_disconnect').on('click', function() {
	qalert("Disconnected");

	$('.button_menu').removeClass('selected');
	$('.bmenus').hide();

	dev.gatt.disconnect();
    });

    // copy to clipboard
    document.querySelector('.debug').addEventListener('doubletap', (event) => {
	var copyText = $('.debug')[0];

	// Select the text field
	copyText.select();
	copyText.setSelectionRange(0, 999999); // For mobile devices

	if (copyText.value != "")
	{
	    // Copy the text inside the text field
	    navigator.clipboard.writeText(copyText.value);

	    copyText.setSelectionRange(0, 0);

	    qalert('Copied to clipboard');
	}
    });

    // hide qalert in click
    $('.qalert').on('click', function() {
	$(this).fadeOut();
    });
});
