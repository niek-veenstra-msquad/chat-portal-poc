<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OllamaService
{
    private string $baseUrl;

    private string $model;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.ollama.host'), '/');
        $this->model = config('services.ollama.model');
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array<int, array{type: string, function: array{name: string, description: string, parameters: array<string, mixed>}}>  $tools
     * @return \Generator<int, array<string, mixed>>
     */
    public function chatStream(array $messages, ?string $model = null, array $tools = []): \Generator
    {
        $payload = [
            'model' => $model ?? $this->model,
            'messages' => $this->normalizeToolCallArguments($messages),
            'stream' => true,
        ];

        if (! empty($tools)) {
            $payload['tools'] = $tools;
        }

        $client = new Client;

        $response = $client->post("{$this->baseUrl}/api/chat", [
            'json' => $payload,
            'stream' => true,
            'timeout' => 240,
        ]);

        $body = $response->getBody();
        $buffer = '';

        while (! $body->eof()) {
            $chunk = $body->read(1024);

            if ($chunk === '') {
                usleep(10000);

                continue;
            }

            $buffer .= $chunk;

            while (($newlinePos = strpos($buffer, "\n")) !== false) {
                $line = substr($buffer, 0, $newlinePos);
                $buffer = substr($buffer, $newlinePos + 1);

                $data = json_decode(trim($line), true);

                if (is_array($data)) {
                    yield $data;
                }
            }
        }

        $remaining = trim($buffer);

        if ($remaining !== '') {
            $data = json_decode($remaining, true);

            if (is_array($data)) {
                yield $data;
            }
        }
    }

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     * @param  array<int, array{type: string, function: array{name: string, description: string, parameters: array<string, mixed>}}>  $tools
     * @return array<string, mixed>
     */
    public function chat(array $messages, ?string $model = null, array $tools = []): array
    {
        $payload = [
            'model' => $model ?? $this->model,
            'messages' => $this->normalizeToolCallArguments($messages),
            'stream' => false,
        ];

        if (! empty($tools)) {
            $payload['tools'] = $tools;
        }

        $response = Http::timeout(240)
            ->post("{$this->baseUrl}/api/chat", $payload);

        if (! $response->successful()) {
            Log::error('Ollama chat error', [
                'status' => $response->status(),
                'body' => $response->body(),
                'last_message' => end($messages),
            ]);
        }

        return $response->json() ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    public function generate(string $prompt, ?string $model = null): array
    {
        $response = Http::timeout(120)
            ->post("{$this->baseUrl}/api/generate", [
                'model' => $model ?? $this->model,
                'prompt' => $prompt,
                'stream' => false,
            ]);

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    public function listModels(): array
    {
        $response = Http::timeout(10)
            ->get("{$this->baseUrl}/api/tags");

        return $response->json();
    }

    /**
     * @param  callable(string $status, int $completed, int $total): void  $onProgress
     */
    public function pullModel(string $model, ?callable $onProgress = null): void
    {
        $client = new Client;

        $response = $client->post("{$this->baseUrl}/api/pull", [
            'json' => ['name' => $model, 'stream' => true],
            'stream' => true,
            'timeout' => 600,
        ]);

        $body = $response->getBody();
        $buffer = '';

        while (! $body->eof()) {
            $chunk = $body->read(1024);

            if ($chunk === '') {
                usleep(50000);

                continue;
            }

            $buffer .= $chunk;

            while (($newlinePos = strpos($buffer, "\n")) !== false) {
                $line = substr($buffer, 0, $newlinePos);
                $buffer = substr($buffer, $newlinePos + 1);

                $data = json_decode(trim($line), true);

                if (! $data) {
                    continue;
                }

                if (isset($data['error'])) {
                    throw new \RuntimeException($data['error']);
                }

                if ($onProgress) {
                    $onProgress(
                        $data['status'] ?? '',
                        $data['completed'] ?? 0,
                        $data['total'] ?? 0,
                    );
                }
            }
        }
    }

    /**
     * Ensure all tool_call arguments in messages are JSON objects.
     *
     * Ollama requires function.arguments to be a JSON object (associative array).
     * When a tool has no parameters, the value may be null, an empty string, or
     * an empty indexed array — this method normalizes those to an empty object.
     *
     * @param  array<int, array<string, mixed>>  $messages
     * @return array<int, array<string, mixed>>
     */
    private function normalizeToolCallArguments(array $messages): array
    {
        foreach ($messages as &$message) {
            if (! isset($message['tool_calls']) || ! is_array($message['tool_calls'])) {
                continue;
            }

            foreach ($message['tool_calls'] as &$toolCall) {
                if (! isset($toolCall['function'])) {
                    continue;
                }

                $args = $toolCall['function']['arguments'] ?? null;

                if (! is_array($args) || $args === [] || array_is_list($args)) {
                    $toolCall['function']['arguments'] = new \stdClass;
                }
            }
        }

        return $messages;
    }
}
