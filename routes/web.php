<?php

use Illuminate\Support\Facades\Route;
use Statamic\Facades\Entry;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::statamic('ymnoi/search', 'search');
Route::statamic('search', 'search');

Route::statamic('presenter', 'presenter/builder', ['title' => 'Setlist Builder']);

Route::get('/presenter/present', fn() => view('presenter.present'));

Route::get('/api/hymns', function () {
    $hymns = Entry::query()
        ->where('collection', 'hymns')
        ->get()
        ->mapWithKeys(fn($entry) => [
            $entry->slug() => [
                'slug'           => $entry->slug(),
                'title'          => $entry->get('title'),
                'greek_lyrics'   => $entry->get('greek_lyrics'),
                'english_lyrics' => $entry->get('english_lyrics'),
            ],
        ]);

    return response()->json($hymns);
});
