<?php

namespace App\Jobs;

use App\Services\OllamaService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class PullOllamaModel implements ShouldQueue
{
    use Queueable;

    public int $timeout = 900;

    public int $tries = 1;

    public function __construct(
        private readonly string $model,
    ) {}

    public function handle(OllamaService $ollama): void
    {
        Cache::put($this->cacheKey(), 'pulling', now()->addMinutes(30));

        try {
            $ollama->pullModel($this->model);
            Cache::put($this->cacheKey(), 'success', now()->addMinutes(5));
        } catch (\Exception $e) {
            Cache::put($this->cacheKey(), 'failed:' . $e->getMessage(), now()->addMinutes(5));
        }
    }

    private function cacheKey(): string
    {
        return "model_pull:{$this->model}";
    }
}
