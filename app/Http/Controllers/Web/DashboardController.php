<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\McpServer;
use App\Services\McpClientService;
use App\Services\OllamaService;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly OllamaService $ollama,
        private readonly McpClientService $mcp,
    ) {}

    public function index(): Response
    {
        $activePulls = Cache::get('model_pulls_active', []);
        $currentlyPulling = ! empty($activePulls) ? array_key_first($activePulls) : null;

        return Inertia::render('dashboard', [
            'models' => Inertia::defer(fn () => $this->loadModels()),
            'mcpTools' => Inertia::defer(fn () => $this->loadMcpTools()),
            'widgetOrder' => auth()->user()->widget_order ?? ['models', 'pull-model', 'mcp-tools'],
            'pullingModel' => $currentlyPulling,
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
            return round($bytes / 1073741824, 1).' GB';
        }

        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1).' MB';
        }

        return round($bytes / 1024, 1).' KB';
    }

    /**
     * @return array{data: array<int, array{name: string, description: string, server: string}>, error: string|null}
     */
    private function loadMcpTools(): array
    {
        try {
            $tools = $this->mcp->getAvailableTools();
            $servers = McpServer::active()->pluck('name', 'id');

            $mapped = collect($tools)->map(fn (array $tool) => [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'server' => $servers[$tool['server_id']] ?? 'Onbekend',
            ])->values()->toArray();

            return ['data' => $mapped, 'error' => null];
        } catch (\Exception) {
            return ['data' => [], 'error' => 'Kan MCP tools niet ophalen.'];
        }
    }
}
