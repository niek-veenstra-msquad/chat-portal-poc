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
use App\Services\McpClientService;
use App\Services\OllamaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use stdClass;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function generateReply(GenerateReplyRequest $request, Chat $chat): StreamedResponse
    {
        set_time_limit(300);

        return new StreamedResponse(function () use ($chat) {
            $history = $chat->messages()
                ->get(['role', 'content'])
                ->map(fn ($msg) => ['role' => $msg->role, 'content' => $msg->content])
                ->toArray();

            $mcpTools = $this->mcp->getAvailableTools();
            $ollamaTools = $this->mcp->toOllamaTools($mcpTools);

            $maxIterations = 10;
            $iteration = 0;
            $allStreamedContent = '';

            do {
                $contentChunk = '';
                $toolCalls = [];
                $hasError = false;

                try {
                    $receivedChunks = false;

                    foreach ($this->ollama->chatStream($history, $chat->model, $ollamaTools) as $data) {
                        $receivedChunks = true;

                        $token = $data['message']['content'] ?? '';

                        if ($token !== '') {
                            $contentChunk .= $token;
                            $allStreamedContent .= $token;
                            $this->sendSseEvent('token', ['content' => $token]);
                        }

                        if (! empty($data['message']['tool_calls'])) {
                            array_push($toolCalls, ...$data['message']['tool_calls']);
                        }
                    }

                    if (! $receivedChunks) {
                        Log::warning('Ollama stream returned no data', [
                            'chat_id' => $chat->id,
                            'model' => $chat->model,
                        ]);
                        $this->sendSseEvent('error', ['message' => 'Ollama gaf geen response.']);
                        $hasError = true;
                    }
                } catch (\Exception $e) {
                    Log::error('Ollama stream error', [
                        'error' => $e->getMessage(),
                        'chat_id' => $chat->id,
                        'model' => $chat->model,
                    ]);
                    $this->sendSseEvent('error', ['message' => 'Fout bij communicatie met Ollama: '.$e->getMessage()]);
                    $hasError = true;
                }

                if ($hasError) {
                    return;
                }

                if (empty($toolCalls)) {
                    break;
                }

                $iteration++;

                if ($iteration > $maxIterations) {
                    break;
                }

                $history[] = ['role' => 'assistant', 'content' => $contentChunk, 'tool_calls' => $toolCalls];

                foreach ($toolCalls as $toolCall) {
                    $toolName = $toolCall['function']['name'] ?? '';
                    $toolArgs = $toolCall['function']['arguments'] ?? new stdClass;

                    $this->sendSseEvent('tool_start', ['name' => $toolName]);

                    $toolResult = $this->mcp->callTool($toolName, $toolArgs);
                    $toolResultContent = $toolResult['result'] ?? $toolResult['error'] ?? 'No result';

                    if (! is_string($toolResultContent)) {
                        $toolResultContent = json_encode($toolResultContent, JSON_UNESCAPED_UNICODE);
                    }

                    $this->sendSseEvent('tool_end', [
                        'name' => $toolName,
                        'result' => mb_substr((string) $toolResultContent, 0, 500),
                    ]);

                    $history[] = [
                        'role' => 'tool',
                        'tool_name' => $toolName,
                        'content' => (string) $toolResultContent,
                    ];
                }
            } while (true);

            if (empty(trim($allStreamedContent)) && $iteration === 0) {
                $allStreamedContent = 'Het model gaf geen tekstueel antwoord.';
                $this->sendSseEvent('token', ['content' => $allStreamedContent]);
            }

            if (! empty(trim($allStreamedContent))) {
                $message = $chat->messages()->create([
                    'role' => 'assistant',
                    'content' => $allStreamedContent,
                ]);

                $this->sendSseEvent('done', [
                    'id' => $message->id,
                    'created_at' => $message->created_at->toISOString(),
                ]);
            } else {
                $this->sendSseEvent('done', [
                    'id' => null,
                    'created_at' => now()->toISOString(),
                ]);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function sendSseEvent(string $event, array $data): void
    {
        echo "event: {$event}\ndata: ".json_encode($data, JSON_UNESCAPED_UNICODE)."\n\n";

        if (ob_get_level()) {
            ob_flush();
        }

        flush();
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
