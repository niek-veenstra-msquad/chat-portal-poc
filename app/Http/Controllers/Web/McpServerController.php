<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\McpServer;
use App\Services\McpClientService;
use Inertia\Inertia;
use Inertia\Response;

class McpServerController extends Controller
{
    public function __construct(
        private McpClientService $mcp,
    ) {}

    public function index(): Response
    {
        $servers = McpServer::latest()->get()->map(fn (McpServer $server) => [
            'id' => $server->id,
            'name' => $server->name,
            'type' => $server->type,
            'url' => $server->url,
            'command' => $server->command,
            'args' => $server->args,
            'env' => $server->env,
            'description' => $server->description,
            'is_active' => $server->is_active,
        ]);

        return Inertia::render('mcp-servers/index', [
            'servers' => $servers,
            'serverTools' => Inertia::defer(fn () => $this->loadToolsByServer()),
        ]);
    }

    /**
     * @return array{data: array<int, array{name: string, description: string}>, error: string|null}
     */
    private function loadToolsByServer(): array
    {
        try {
            $tools = $this->mcp->getAvailableTools();

            $grouped = collect($tools)
                ->groupBy('server_id')
                ->map(fn ($serverTools) => $serverTools->map(fn (array $tool) => [
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                ])->values()->toArray())
                ->toArray();

            return ['data' => $grouped, 'error' => null];
        } catch (\Exception) {
            return ['data' => [], 'error' => 'Kan tools niet ophalen.'];
        }
    }
}
