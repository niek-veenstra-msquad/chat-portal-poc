<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DeleteChatRequest;
use App\Http\Requests\Api\GenerateReplyRequest;
use App\Http\Requests\Api\OlderMessagesRequest;
use App\Http\Requests\Api\SendMessageRequest;
use App\Http\Requests\Api\StoreChatRequest;
use App\Http\Requests\Api\TogglePinRequest;
use App\Http\Requests\Api\UpdateChatRequest;
use App\Models\Chat;
use App\Services\OllamaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class ChatController extends Controller
{
    public function __construct(
        private readonly OllamaService $ollama,
    ) {}

    public function store(StoreChatRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $chat = $request->user()->chats()->create([
            'title' => $validated['title'],
            'model' => config('services.ollama.model'),
        ]);

        return redirect()->route('chats.show', $chat);
    }

    public function update(UpdateChatRequest $request, Chat $chat): RedirectResponse
    {
        $validated = $request->validated();

        $chat->update([
            'title' => $validated['title'],
        ]);

        return redirect()->back();
    }

    public function sendMessage(SendMessageRequest $request, Chat $chat): RedirectResponse
    {
        $validated = $request->validated();

        $chat->messages()->create([
            'role' => 'user',
            'content' => $validated['content'],
        ]);

        return redirect()->route('chats.show', $chat);
    }

    public function generateReply(GenerateReplyRequest $request, Chat $chat): JsonResponse
    {
        $history = $chat->messages()
            ->get(['role', 'content'])
            ->map(fn ($msg) => ['role' => $msg->role, 'content' => $msg->content])
            ->toArray();

        $response = $this->ollama->chat($history, $chat->model);

        $message = $chat->messages()->create([
            'role' => 'assistant',
            'content' => $response['message']['content'] ?? 'Geen antwoord ontvangen.',
        ]);

        return response()->json([
            'id' => $message->id,
            'role' => $message->role,
            'content' => $message->content,
            'created_at' => $message->created_at->toISOString(),
        ]);
    }

    public function olderMessages(OlderMessagesRequest $request, Chat $chat): JsonResponse
    {
        $beforeId = (int) $request->validated('before');

        $messages = $chat->messages()
            ->where('id', '<', $beforeId)
            ->latest('id')
            ->take(50)
            ->get()
            ->reverse()
            ->values()
            ->map(fn ($msg) => [
                'id' => $msg->id,
                'role' => $msg->role,
                'content' => $msg->content,
                'created_at' => $msg->created_at->toISOString(),
            ]);

        $hasMore = $chat->messages()
            ->where('id', '<', $beforeId)
            ->count() > 50;

        return response()->json([
            'messages' => $messages,
            'hasMore' => $hasMore,
        ]);
    }

    public function destroy(DeleteChatRequest $request, Chat $chat): RedirectResponse
    {
        $chat->delete();

        return redirect()->route('dashboard');
    }

    public function togglePin(TogglePinRequest $request, Chat $chat): RedirectResponse
    {
        $chat->update([
            'pinned_at' => $chat->pinned_at ? null : now(),
        ]);

        return redirect()->back();
    }
}
