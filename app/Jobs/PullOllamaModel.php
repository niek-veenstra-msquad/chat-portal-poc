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
        Cache::put($this->cacheKey(), json_encode([
            'status' => 'pulling',
            'progress' => 0,
            'detail' => 'Starting download...',
        ]), now()->addMinutes(30));

        try {
            $ollama->pullModel($this->model, function (string $status, int $completed, int $total) {
                $progress = $total > 0 ? round(($completed / $total) * 100) : 0;

                Cache::put($this->cacheKey(), json_encode([
                    'status' => 'pulling',
                    'progress' => $progress,
                    'completed' => $completed,
                    'total' => $total,
                    'detail' => $status,
                ]), now()->addMinutes(30));
            });

            Cache::put($this->cacheKey(), json_encode([
                'status' => 'success',
            ]), now()->addMinutes(5));

            $this->removeFromActivePulls();
        } catch (\Exception $e) {
            Cache::put($this->cacheKey(), json_encode([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ]), now()->addMinutes(5));

            $this->removeFromActivePulls();
        }
    }

    private function cacheKey(): string
    {
        return "model_pull:{$this->model}";
    }

    private function removeFromActivePulls(): void
    {
        $activePulls = Cache::get('model_pulls_active', []);
        unset($activePulls[$this->model]);
        Cache::put('model_pulls_active', $activePulls, now()->addMinutes(30));
    }
}
