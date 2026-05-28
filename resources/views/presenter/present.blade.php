<!doctype html>
<html lang="el">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Παρουσίαση</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Sofia+Sans:ital,wght@0,100;0,400;0,700;1,100;1,400;1,700&display=swap" rel="stylesheet" />
    @vite(['resources/css/site.scss', 'resources/js/presenter.js'])
</head>
<body class="presenter-body">

    <div id="presenter">
        <div id="slide" class="slide slide--blank"></div>
        <nav id="controls" class="presenter-controls">
            <button id="btn-prev" aria-label="Προηγούμενο">←</button>
            <span id="progress">– / –</span>
            <button id="btn-next" aria-label="Επόμενο">→</button>
            <button id="btn-fullscreen" aria-label="Πλήρης οθόνη">⛶</button>
        </nav>
    </div>

</body>
</html>
