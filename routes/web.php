<?php

use App\Http\Controllers\Web\ChatController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    Route::get('chats/{chat}', [ChatController::class, 'show'])->name('chats.show');
});

require __DIR__.'/settings.php';
