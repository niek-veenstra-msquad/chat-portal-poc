<?php

use App\Http\Controllers\Web\ChatController;
use App\Http\Controllers\Web\DashboardController;
use App\Http\Controllers\Web\McpServerController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('chats/{chat}', [ChatController::class, 'show'])->name('chats.show');

    Route::get('mcp-servers', [McpServerController::class, 'index'])->name('mcp-servers.index');
});

require __DIR__.'/settings.php';
