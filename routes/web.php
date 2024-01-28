<?php

use Illuminate\Support\Facades\Route;

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

use App\Livewire\Livesearch;

Route::statamic('ymnoi/search', 'search');
Route::statamic('search', 'search');

use App\Livewire\Counter;

Route::get('/counter', Counter::class);
