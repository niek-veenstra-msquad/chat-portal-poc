<?php

namespace App\Http\Controllers\Web;

use App\DTO\ChatData;
use App\DTO\ChatMessageData;
use App\Http\Controllers\Controller;
use App\Models\Chat;
use Inertia\Inertia;
use Inertia\Response;

class ChatController extends Controller
{
    private const MESSAGES_PER_PAGE = 50;

    public function show(Chat $chat): Response
    {
        abort_unless($chat->user_id === auth()->id(), 403);

        $latestIds = $chat->messages()
            ->latest('id')
            ->take(self::MESSAGES_PER_PAGE)
            ->pluck('id');

        $messages = $chat->messages()
            ->whereIn('id', $latestIds)
            ->oldest('id')
            ->get();

        return Inertia::render('chats/show', [
            'chat' => ChatData::fromModel($chat),
            'messages' => $messages->map(ChatMessageData::fromModel(...))->values(),
            'hasMore' => $chat->messages()->count() > self::MESSAGES_PER_PAGE,
        ]);
    }
}
