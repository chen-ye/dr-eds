<?php

$tmp_file = "/tmp/dreds_upload.json";

$allowed = @json_decode(file_get_contents($tmp_file), true);
if (!is_array($allowed)) $allowed = array();

// clear old
if (count($allowed))
foreach ($allowed as $time => $value)
{
    if ($time + 5 < time()) unset($allowed[$time]);
}

$step = $_POST['step'];

if ($step == "allow")
{
    $hash = bin2hex(random_bytes(10));
    $allowed[microtime(true)] = $hash;

    file_put_contents($tmp_file, json_encode($allowed));

    echo json_encode(array("result" => "OK", "hash" => $hash));
} else
if ($step == "put")
{
    $hash = $_POST['hash'];

    if (in_array($hash, $allowed))
    {
	$log = $_POST['log'];

	preg_match('#Connected to (.*?)\n#is', $log, $matches);
	$device = $matches[1];
	if (
	    ($device != "EDS OX") &&
	    ($device != "EDS TX") &&
	    ($device != "EDS GeX")
	) $device = "unknown";

	if (!file_exists("logs")) mkdir("logs");
	if (!file_exists("logs/index.html"))
	{
	    $fp = fopen("logs/index.html", "w+");
	    fclose($fp);
	}
	if (!file_exists("logs/" . $device)) mkdir("logs/" . $device);
	if (!file_exists("logs/" . $device . "/index.html"))
	{
	    $fp = fopen("logs/" . $device ."/index.html", "w+");
	    fclose($fp);
	}

	$slog = preg_replace('#[0-9]{14}\.[-0-9]{3}\> #', '', $log);
	//$slog = str_replace("\n", "", $slog);
	preg_match_all('#block [0-9]{1,2}\: [\w\W]{1,16}#is', $slog, $m2);
	$m2 = preg_replace('#block [0-9]{1,2}\: #', '', $m2[0]);

	file_put_contents("logs/" . $device . "/" . microtime(true), join("", $m2) . "\n\n=== raw low ===\n\n" . $log);

	echo json_encode(array("result" => "OK"));
    }
}

?>
