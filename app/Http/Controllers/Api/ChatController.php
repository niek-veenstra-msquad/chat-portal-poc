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
use App\Services\McpClientService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;

class ChatController extends Controller
{
    public function __construct(
        private readonly OllamaService $ollama,
        private readonly McpClientService $mcp,
    ) {}

    public function store(StoreChatRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $chat = $request->user()->chats()->create([
            'title' => $validated['title'],
            'model' => $validated['model'],
        ]);

        return redirect()->route('chats.show', $chat);
    }

    public function update(UpdateChatRequest $request, Chat $chat): JsonResponse
    {
        $validated = $request->validated();

        $chat->update([
            'title' => $validated['title'],
        ]);

        return response()->json(['success' => true]);
    }

    public function sendMessage(SendMessageRequest $request, Chat $chat): JsonResponse
    {
        $validated = $request->validated();

        $message = $chat->messages()->create([
            'role' => 'user',
            'content' => $validated['content'],
        ]);

        return response()->json([
            'id' => $message->id,
            'role' => $message->role,
            'content' => $message->content,
            'created_at' => $message->created_at->toISOString(),
        ]);
    }

    public function generateReply(GenerateReplyRequest $request, Chat $chat): JsonResponse
    {
        set_time_limit(300);

        $history = $chat->messages()
            ->get(['role', 'content'])
            ->map(fn ($msg) => ['role' => $msg->role, 'content' => $msg->content])
            ->toArray();

        $mcpTools = $this->mcp->getAvailableTools();
        $ollamaTools = $this->mcp->toOllamaTools($mcpTools);

        $response = $this->ollama->chat($history, $chat->model, $ollamaTools);

        $maxIterations = 10;
        $iteration = 0;

        while (isset($response['message']['tool_calls']) && $iteration < $maxIterations) {
            $iteration++;

            $history[] = $response['message'];

            foreach ($response['message']['tool_calls'] as $toolCall) {
                $toolName = $toolCall['function']['name'] ?? '';
                $toolArgs = $toolCall['function']['arguments'] ?? [];

                $toolResult = $this->mcp->callTool($toolName, $toolArgs);

                $history[] = [
                    'role' => 'tool',
                    'content' => $toolResult['result'] ?? $toolResult['error'] ?? 'No result',
                ];
            }

            $response = $this->ollama->chat($history, $chat->model, $ollamaTools);
        }

        $content = $response['message']['content'] ?? 'Geen antwoord ontvangen.';

        $message = $chat->messages()->create([
            'role' => 'assistant',
            'content' => $content,
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

        $olderIds = $chat->messages()
            ->where('id', '<', $beforeId)
            ->latest('id')
            ->take(50)
            ->pluck('id');

        $messages = $chat->messages()
            ->whereIn('id', $olderIds)
            ->oldest('id')
            ->get()
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

    public function destroy(DeleteChatRequest $request, Chat $chat): JsonResponse
    {
        $chat->delete();

        return response()->json(['success' => true]);
    }

    public function togglePin(TogglePinRequest $request, Chat $chat): JsonResponse
    {
        $chat->update([
            'pinned_at' => $chat->pinned_at ? null : now(),
        ]);

        return response()->json(['success' => true]);
    }
}
