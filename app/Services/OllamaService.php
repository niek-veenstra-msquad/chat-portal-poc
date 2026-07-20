<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

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
     * @return array<string, mixed>
     */
    public function chat(array $messages, ?string $model = null, array $tools = []): array
    {
        $payload = [
            'model' => $model ?? $this->model,
            'messages' => $messages,
            'stream' => false,
        ];

        if (! empty($tools)) {
            $payload['tools'] = $tools;
        }

        $response = Http::timeout(240)
            ->post("{$this->baseUrl}/api/chat", $payload);

        return $response->json();
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
     * @return array<string, mixed>
     */
    public function pullModel(string $model): array
    {
        $response = Http::timeout(600)
            ->post("{$this->baseUrl}/api/pull", [
                'name' => $model,
                'stream' => false,
            ]);

        return $response->json();
    }

    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/api/tags");

            return $response->successful();
        } catch (\Exception) {
            return false;
        }
    }
}
