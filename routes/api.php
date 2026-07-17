<?php

use App\Http\Controllers\Api\ChatController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'verified'])->group(function () {
    Route::post('chats', [ChatController::class, 'store'])->name('chats.store');
    Route::patch('chats/{chat}', [ChatController::class, 'update'])->name('chats.update');
    Route::post('chats/{chat}/messages', [ChatController::class, 'sendMessage'])->name('chats.messages.store');
    Route::get('chats/{chat}/messages', [ChatController::class, 'olderMessages'])->name('chats.messages.older');
    Route::post('chats/{chat}/generate-reply', [ChatController::class, 'generateReply'])->name('chats.generate-reply');
    Route::post('chats/{chat}/toggle-pin', [ChatController::class, 'togglePin'])->name('chats.toggle-pin');
    Route::delete('chats/{chat}', [ChatController::class, 'destroy'])->name('chats.destroy');
});
