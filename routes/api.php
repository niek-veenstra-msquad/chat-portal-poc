<?php

use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\McpServerController;
use App\Http\Controllers\Api\ModelController;
use App\Http\Controllers\Api\WidgetController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'verified'])->group(function () {
    Route::post('chats', [ChatController::class, 'store'])->name('chats.store');
    Route::patch('chats/{chat}', [ChatController::class, 'update'])->name('chats.update');
    Route::post('chats/{chat}/messages', [ChatController::class, 'sendMessage'])->name('chats.messages.store');
    Route::get('chats/{chat}/messages', [ChatController::class, 'olderMessages'])->name('chats.messages.older');
    Route::post('chats/{chat}/generate-reply', [ChatController::class, 'generateReply'])->name('chats.generate-reply');
    Route::post('chats/{chat}/toggle-pin', [ChatController::class, 'togglePin'])->name('chats.toggle-pin');
    Route::delete('chats/{chat}', [ChatController::class, 'destroy'])->name('chats.destroy');

    Route::post('models/pull', [ModelController::class, 'pull'])->name('models.pull');
    Route::get('models/pull-status', [ModelController::class, 'status'])->name('models.pull-status');
    Route::get('models', [ModelController::class, 'index'])->name('models.index');

    Route::post('mcp-servers', [McpServerController::class, 'store'])->name('mcp-servers.store');
    Route::patch('mcp-servers/{mcpServer}', [McpServerController::class, 'update'])->name('mcp-servers.update');
    Route::delete('mcp-servers/{mcpServer}', [McpServerController::class, 'destroy'])->name('mcp-servers.destroy');
    Route::post('mcp-servers/{mcpServer}/toggle-active', [McpServerController::class, 'toggleActive'])->name('mcp-servers.toggle-active');

    Route::patch('widgets/order', [WidgetController::class, 'updateOrder'])->name('widgets.update-order');
});
