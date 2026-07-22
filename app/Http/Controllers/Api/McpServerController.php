<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreMcpServerRequest;
use App\Http\Requests\Api\UpdateMcpServerRequest;
use App\Models\McpServer;
use Illuminate\Http\JsonResponse;

class McpServerController extends Controller
{
    public function store(StoreMcpServerRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $validated['env'] = $this->transformEnv($validated['env'] ?? null);

        McpServer::create($validated);

        return response()->json(['success' => true]);
    }

    public function update(UpdateMcpServerRequest $request, McpServer $mcpServer): JsonResponse
    {
        $validated = $request->validated();
        $validated['env'] = $this->transformEnv($validated['env'] ?? null);

        $mcpServer->update($validated);

        return response()->json(['success' => true]);
    }

    public function destroy(McpServer $mcpServer): JsonResponse
    {
        $mcpServer->delete();

        return response()->json(['success' => true]);
    }

    public function toggleActive(McpServer $mcpServer): JsonResponse
    {
        $mcpServer->update([
            'is_active' => ! $mcpServer->is_active,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * @param  array<int, array{key: string, value: string}>|null  $env
     * @return array<string, string>|null
     */
    private function transformEnv(?array $env): ?array
    {
        if (empty($env)) {
            return null;
        }

        return collect($env)->pluck('value', 'key')->toArray();
    }
}
