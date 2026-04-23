import { store } from './store.js';
import { 
    bleClient, appState, locale,
    cmd_rearLifting, cmd_setGearUpValue, cmd_setFrontGearLimit, cmd_setTotalGear, 
    cmd_getCurrentGear, cmd_frontLifting, cmd_shutdown, cmd_backDialSleep,
    log, setup, _setItem, _getItem, qalert, error, startBlock, endBlock, closePopup, _dialog,
    characteristic_TX, setCRC16, buildPresets, detectDoubleTap, timeoutCheck
} from './ble-client.js';

$(document).ready(function() {
    console.log('UI-LEGACY: document ready, binding handlers');
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

    appState.show_debug = _getItem('show_debug');
    // set appState.show_debug by default
    if (appState.show_debug == null) appState.show_debug = 0;
    if (appState.show_debug == 1) {
	$('.debug').html(appState.debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
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
        setup();
        $('.scan').hide();
        startBlock('Connecting...');
        bleClient.connect();
    });

    // shift up
    $('.settings .action_buttons .button.up, .ox2settings .action_buttons .button.up, .txsettings .action_buttons .button.up, .gxsettings .action_buttons .button.up, .live .action_buttons .button.up').on('click', function() {
     console.log('UI-LEGACY: shift up clicked, key:', appState.key);
     qalert(lang['L_UP_SHIFT']);
	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: rearLifting -> " + f.toString(16).padStart(2, '0'));
    });
    // shift down
    $('.settings .action_buttons .button.down, .ox2settings .action_buttons .button.down, .txsettings .action_buttons .button.down, .gxsettings .action_buttons .button.down, .live .action_buttons .button.down').on('click', function() {
	qalert(lang['L_DOWN_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_rearLifting, 0x01, f, 0x00, 0x00 ]);
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
	    var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
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
	    var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
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
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_frontLifting, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: frontLifting -> " + f.toString(16).padStart(2, '0'));
    });

    // number of gears
    $('.settings .action_buttons .button.gears select, .ox2settings .action_buttons .button.gears select, .txsettings .action_buttons .button.gears select, .gxsettings .action_buttons .button.gears select').on('change', function() {
	var t = $(this).val();
	if (t < parseInt(appState.info['NUM']) + 1) {
	    endBlock();
	    qalert(lang['L_ERROR_INVALID_NUMBER_OF_GEARS'], 0);

	    $('.settings .action_buttons .button.gears select').val(appState.info['TOTAL_CNT']);
	} else {
	    startBlock("Change number of gears");
	    var f = t;
	    var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setTotalGear, 0x01, f, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: setTotalGear -> " + f.toString(16).padStart(2, '0'));

	    appState.ctimeout = setTimeout(timeoutCheck, 1000);
	}
    });

    // micro shift up
    $('.settings .micro .up, .ox2settings .micro .up, .txsettings .micro .up, .gxsettings .micro .up').on('click', function() {
	qalert(lang['L_UP_MICRO_SHIFT']);

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16).padStart(2, '0'));
    });
    // micro shift down
    $('.settings .micro .down, .ox2settings .micro .down, .txsettings .micro .down, .gxsettings .micro .down').on('click', function() {
	qalert(lang['L_DOWN_MICRO_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_fineTuneGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneGear -> " + f.toString(16).padStart(2, '0'));
    });
    // front micro shift up
    $('.txsettings .front_micro .up').on('click', function() {
	qalert(lang['L_FRONT_UP_MICRO_SHIFT']);

	var f = 0x02;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16).padStart(2, '0'));
    });
    // front micro shift down
    $('.txsettings .front_micro .down').on('click', function() {
	qalert(lang['L_FRONT_DOWN_MICRO_SHIFT']);

	var f = 0x01;
	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_fineTuneFrontGear, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: fineTuneFrontGear -> " + f.toString(16).padStart(2, '0'));
    });

    // set all gear values
    $('.settings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	appState.all_gears = [];
	$('.settings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    appState.all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of appState.all_gears
	var v = appState.all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.ox2settings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	appState.all_gears = [];
	$('.ox2settings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    appState.all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of appState.all_gears
	var v = appState.all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.txsettings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	appState.all_gears = [];
	$('.txsettings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    appState.all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of appState.all_gears
	var v = appState.all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
    });
    $('.gxsettings .gear_values .vcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_VALUES']);

	appState.all_gears = [];
	$('.gxsettings .gear_values .vcontent .content input').each(function() {
	    var g = $(this).parent().attr('gear');
	    var v = $(this).val();

	    appState.all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of appState.all_gears
	var v = appState.all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setGearUpValue, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setGearUpValue -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
    });
    // set all front limits
    $('.txsettings .gear_values .fvcontent .button.set_all').on('click', function() {
	startBlock(lang['L_UPDATE_ALL_LIMITS']);

	appState.all_gears = [];
	$('.txsettings .gear_values .fvcontent .content input').each(function() {
	    var g = $(this).parent().attr('front');
	    var v = $(this).val();

	    appState.all_gears.push({
		'gear': g,
		'value': v
	    });
	});

	// start iteration of appState.all_gears
	var v = appState.all_gears.shift();

	var v2 = (v.value & 0xFF);
	var v1 = ((v.value >> 8) & 0xFF);

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_setFrontGearLimit, 0x03, v.gear, v1, v2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: setFrontGearLimit -> " + v.gear.toString(16).padStart(2, '0') + ' = ' + v.value);

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
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
		if (s[appState.device_type] == null) s[appState.device_type] = {};

		s[appState.device_type][n] = {};

	        var r = [];
		var pr = "";
		if (appState.device_type == "EDS TX") {
		    pr = "tx";
		    $('.txsettings .gear_values .fvcontent input').each(function() {
			var g = $(this).parent().attr('front');
			var v = $(this).val();

			r.push({
			    'gear': g,
			    'value': v
			});
		    });
		    s[appState.device_type][n]['front'] = r;
		}
		if (appState.device_type == "EDS GeX") pr = "gx";
		if (appState.device_type == "EDS OX2") pr = "ox2";

		r = [];
		$('.' + pr + 'settings .gear_values .vcontent input').each(function() {
		    var g = $(this).parent().attr('gear');
		    var v = $(this).val();

		    r.push({
			'gear': g,
			'value': v
		    });
		});
		s[appState.device_type][n]['rear'] = r;

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
		'appState.debug': $('.button_debug').hasClass('selected'),
		'page': $('.button_page').hasClass('icon-wrench') ? "live" : "settings",
		'battery': _getItem('battery'),
		'lock': _getItem('lock'),
		'current': {
		    'device': appState.device_type,
		    'rear': []
		}
	    };
	    var pr = "";
	    if (appState.device_type == "EDS TX") {
		pr = "tx";
		exp.current.front = [];
	    }
	    if (appState.device_type == "EDS GeX") pr = "gx";
	    if (appState.device_type == "EDS OX2") pr = "ox2";
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
		'appState.debug': $('.button_debug').hasClass('selected'),
		'page': $('.button_page').hasClass('icon-wrench') ? "live" : "settings",
		'battery': _getItem('battery'),
		'lock': _getItem('lock'),
		'current': {
		    'device': appState.device_type,
		    'rear': []
		}
	    };
	    var pr = "";
	    if (appState.device_type == "EDS TX") {
		pr = "tx";
		exp.current.front = [];
	    }
	    if (appState.device_type == "EDS GeX") pr = "gx";
	    if (appState.device_type == "EDS OX2") pr = "ox2";
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
		    if (g.hasOwnProperty('appState.debug'))
			if (g.debug) {
			    $('.debug').html(appState.debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
			    $('body').addClass('logs');
			    $('.button_debug').addClass('selected');
			    _setItem('appState.show_debug', 1);
			} else {
			    $('.debug').hide();
			    $('body').removeClass('logs');
			    $('.button_debug').removeClass('selected');
			    _setItem('appState.show_debug', 0);
			}
		    if (g.hasOwnProperty('page'))
			if (g.page == "settings") {
			    if (appState.device_type == "EDS OX")
				$('.settings').show();
			    else
			    if (appState.device_type == "EDS OX2")
				$('.ox2settings').show();
			    else
			    if (appState.device_type == "EDS TX")
				$('.txsettings').show();
			    else
			    if (appState.device_type == "EDS GeX")
				$('.gxsettings').show();
			    $('.live').hide();
			    $('.info').removeClass('big');
			    $('.button_page').removeClass('icon-wrench').addClass('icon-bike');
			    _setItem('appState.show_page', "settings");
			    appState.show_page = "settings";
			} else {
			    $('.settings').hide();
			    $('.ox2settings').hide();
			    $('.txsettings').hide();
			    $('.gxsettings').hide();
			    $('.live').show();
			    $('.info').addClass('big');
			    $('.button_page').removeClass('icon-bike').addClass('icon-wrench');
			    _setItem('appState.show_page', "live");
			    appState.show_page = "live";
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
			    if (appState.device_type == g.current.device) {
				var pr = "";
				if (appState.device_type == "EDS TX") {
				    pr = "tx";
				    for (var t in g.current.front) {
					$('.' + pr + 'settings .gear_values .fvcontent .front[front="' + g.current.front[t].gear + '"] input').val(g.current.front[t].value);
				    }
				}
				if (appState.device_type == "EDS GeX") pr = "gx";
				if (appState.device_type == "EDS OX2") pr = "ox2";
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

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_switchFingerOrder, 0x01, f, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f.toString(16).padStart(2, '0'));

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
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

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_switchFingerOrder, 0x04, 0, f1, 0, f2, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f.toString(16).padStart(2, '0'));

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
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

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_switchFingerOrder, 0x03, f1, f2, f3, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
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

	var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_switchFingerOrder, 0x03, f1, f2, f3, 0x00, 0x00 ]);
	a = setCRC16(a);
	characteristic_TX.writeValueWithoutResponse(a);
	log("Send: switchFingerOrder -> " + f1.toString(16).padStart(2, '0') + ' ' + f2.toString(16).padStart(2, '0') + ' ' + f3.toString(16).padStart(2, '0'));

	appState.ctimeout = setTimeout(timeoutCheck, 1000);
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

    // appState.debug
    $('.button_debug').on('click', function() {
	if ($(this).hasClass('selected')) {
	    $('.debug').hide();
	    $('body').removeClass('logs');
	    $(this).removeClass('selected');
	    _setItem('appState.show_debug', 0);
	    $('.button_menu').trigger('click');
	} else {
	    $('.debug').html(appState.debug_log.join("\n")).show().scrollTop($('.debug').prop("scrollHeight"));
	    $('body').addClass('logs');
	    $(this).addClass('selected');
	    _setItem('appState.show_debug', 1);
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
	    if (appState.device_type == "EDS OX")
		$('.settings').show();
	    else
	    if (appState.device_type == "EDS OX2")
		$('.ox2settings').show();
	    else
	    if (appState.device_type == "EDS TX")
		$('.txsettings').show();
	    else
	    if (appState.device_type == "EDS GeX")
		$('.gxsettings').show();
	    $('.live').hide();
	    $('.info').removeClass('big');
	    $(this).removeClass('icon-wrench').addClass('icon-bike');
	    _setItem('appState.show_page', 'settings');
	    appState.show_page = "settings";
	    $('.button_menu').trigger('click');
	} else {
	    $('.settings').hide();
	    $('.ox2settings').hide();
	    $('.txsettings').hide();
	    $('.gxsettings').hide();
	    $('.live').show();
	    $('.info').addClass('big');
	    $(this).removeClass('icon-bike').addClass('icon-wrench');
	    _setItem('appState.show_page', 'live');
	    appState.show_page = "live";
	    $('.button_menu').trigger('click');
	}
    });

    // shutdown
    $('.button_shutdown').on('click', function() {
	_dialog(lang['L_CONFIRM_SHUTDOWN'] + ' ' + appState.device_type + '?', '', function(e) {
	    e.preventDefault();
	    closePopup();
	}, function(e) {
	    e.preventDefault();

	    qalert(lang['L_SHUTDOWN']);

	    var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_shutdown, 0x00, 0x00, 0x00 ]);
	    a = setCRC16(a);
	    characteristic_TX.writeValueWithoutResponse(a);
	    log("Send: shutdown");

	    $('.button_menu').removeClass('selected');
	    $('.bmenus').hide();

	    dev.gatt.disconnect();

	    closePopup();
	});

	/*if (confirm(lang['L_CONFIRM_SHUTDOWN'] + ' ' + appState.device_type + '?')) {
	    qalert(lang['L_SHUTDOWN']);

	    var a = new Uint8Array([ 0xfe, 0x32, appState.key, cmd_shutdown, 0x00, 0x00, 0x00 ]);
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
		'appState.info': '0.8em',
		'live': '1em',
		'settings': '1em'
	    };
	}
	//var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-info").replace('em', ''));
	//a = a - 0.05;
	//document.documentElement.style.setProperty('--font-size-info', a + 'em');
	//z.info = a + 'em';
	if (appState.show_page == "live") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-live").replace('em', ''));
	    a = a - 0.05;
	    document.documentElement.style.setProperty('--font-size-live', a + 'em');
	    z.live = a + 'em';
	} else
	if (appState.show_page == "settings") {
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
		'appState.info': '0.8em',
		'live': '1em',
		'settings': '1em'
	    };
	}
	//var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-info").replace('em', ''));
	//a = a + 0.05;
	//document.documentElement.style.setProperty('--font-size-info', a + 'em');
	//z.info = a + 'em';
	if (appState.show_page == "live") {
	    var a = parseFloat(getComputedStyle(document.documentElement,null).getPropertyValue("--font-size-live").replace('em', ''));
	    a = a + 0.05;
	    document.documentElement.style.setProperty('--font-size-live', a + 'em');
	    z.live = a + 'em';
	} else
	if (appState.show_page == "settings") {
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

