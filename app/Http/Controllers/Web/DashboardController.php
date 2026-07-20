<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\OllamaService;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly OllamaService $ollama,
    ) {}

    public function index(): Response
    {
        return Inertia::render('dashboard', [
            'models' => Inertia::defer(fn () => $this->loadModels()),
        ]);
    }

    /**
     * @return array{data: array<int, array{name: string, size: string, modified_at: string}>, error: string|null}
     */
    private function loadModels(): array
    {
        try {
            $response = $this->ollama->listModels();
            $models = collect($response['models'] ?? [])->map(fn (array $model) => [
                'name' => $model['name'],
                'size' => $this->formatBytes($model['size'] ?? 0),
                'modified_at' => $model['modified_at'] ?? '',
            ])->values()->toArray();

            return ['data' => $models, 'error' => null];
        } catch (\Exception) {
            return ['data' => [], 'error' => 'Kan geen verbinding maken met Ollama.'];
        }
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 1) . ' GB';
        }

        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }

        return round($bytes / 1024, 1) . ' KB';
    }
}
