<?php

namespace App\Services;

use App\Models\McpServer;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class McpClientService
{
    /**
     * @return array<int, array{name: string, description: string, parameters: array<string, mixed>, server_id: int}>
     */
    public function getAvailableTools(): array
    {
        $servers = McpServer::active()->get();
        $tools = [];

        foreach ($servers as $server) {
            try {
                $serverTools = $this->listTools($server);
                foreach ($serverTools as $tool) {
                    $tools[] = [
                        'name' => $tool['name'],
                        'description' => $tool['description'] ?? '',
                        'parameters' => $tool['inputSchema'] ?? ['type' => 'object', 'properties' => new \stdClass()],
                        'server_id' => $server->id,
                    ];
                }
            } catch (\Exception $e) {
                Log::warning("Failed to list tools from MCP server [{$server->name}]: {$e->getMessage()}");
            }
        }

        return $tools;
    }

    /**
     * @return array<string, mixed>
     */
    public function callTool(string $toolName, array $arguments): array
    {
        $servers = McpServer::active()->get();

        foreach ($servers as $server) {
            try {
                $serverTools = $this->listTools($server);
                $toolExists = collect($serverTools)->contains('name', $toolName);

                if ($toolExists) {
                    return $this->executeTool($server, $toolName, $arguments);
                }
            } catch (\Exception $e) {
                Log::warning("Failed to call tool [{$toolName}] on MCP server [{$server->name}]: {$e->getMessage()}");
            }
        }

        return ['error' => "Tool '{$toolName}' not found on any active MCP server."];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function listTools(McpServer $server): array
    {
        $request = [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/list',
        ];

        $data = $server->isStdio()
            ? $this->sendStdio($server, $request)
            : $this->sendHttp($server, $request);

        return $data['result']['tools'] ?? [];
    }

    /**
     * @return array<string, mixed>
     */
    private function executeTool(McpServer $server, string $toolName, array $arguments): array
    {
        $request = [
            'jsonrpc' => '2.0',
            'id' => 1,
            'method' => 'tools/call',
            'params' => [
                'name' => $toolName,
                'arguments' => $arguments,
            ],
        ];

        $data = $server->isStdio()
            ? $this->sendStdio($server, $request, 30)
            : $this->sendHttp($server, $request, 30);

        if (isset($data['error'])) {
            return ['error' => $data['error']['message'] ?? 'Unknown MCP error'];
        }

        $content = $data['result']['content'] ?? [];
        $textParts = collect($content)
            ->where('type', 'text')
            ->pluck('text')
            ->implode("\n");

        return ['result' => $textParts ?: json_encode($content)];
    }

    /**
     * @return array<string, mixed>
     */
    private function sendHttp(McpServer $server, array $request, int $timeout = 10): array
    {
        $response = Http::timeout($timeout)
            ->withHeaders([
                'Content-Type' => 'application/json',
                'Accept' => 'application/json, text/event-stream',
            ])
            ->post($server->url, $request);

        if (! $response->successful()) {
            throw new \RuntimeException("MCP server responded with status {$response->status()}");
        }

        return $response->json();
    }

    /**
     * @return array<string, mixed>
     */
    private function sendStdio(McpServer $server, array $request, int $timeout = 10): array
    {
        $command = $server->command;

        if (! $command) {
            throw new \RuntimeException("No command configured for stdio MCP server [{$server->name}]");
        }

        $descriptorspec = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($command, $descriptorspec, $pipes, null, null);

        if (! is_resource($process)) {
            throw new \RuntimeException("Failed to start MCP stdio process: {$command}");
        }

        try {
            $initRequest = json_encode([
                'jsonrpc' => '2.0',
                'id' => 0,
                'method' => 'initialize',
                'params' => [
                    'protocolVersion' => '2024-11-05',
                    'capabilities' => new \stdClass(),
                    'clientInfo' => [
                        'name' => 'chat-portal',
                        'version' => '1.0.0',
                    ],
                ],
            ]);

            fwrite($pipes[0], $initRequest . "\n");
            $initResponse = $this->readLineWithTimeout($pipes[1], $timeout);

            $notification = json_encode([
                'jsonrpc' => '2.0',
                'method' => 'notifications/initialized',
            ]);
            fwrite($pipes[0], $notification . "\n");

            $payload = json_encode($request);
            fwrite($pipes[0], $payload . "\n");

            $responseLine = $this->readLineWithTimeout($pipes[1], $timeout);

            $data = json_decode($responseLine, true);

            if (! is_array($data)) {
                throw new \RuntimeException("Invalid JSON response from stdio MCP server");
            }

            return $data;
        } finally {
            fclose($pipes[0]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            proc_terminate($process);
            proc_close($process);
        }
    }

    private function readLineWithTimeout($pipe, int $timeout): string
    {
        stream_set_blocking($pipe, false);
        $startTime = time();
        $buffer = '';

        while ((time() - $startTime) < $timeout) {
            $chunk = fgets($pipe);
            if ($chunk !== false) {
                $buffer .= $chunk;
                if (str_ends_with(trim($buffer), '}')) {
                    $decoded = json_decode(trim($buffer), true);
                    if (is_array($decoded)) {
                        return trim($buffer);
                    }
                }
            }
            usleep(10000);
        }

        throw new \RuntimeException("Timeout waiting for MCP stdio response");
    }

    /**
     * Convert MCP tools to Ollama tool format.
     *
     * @param  array<int, array{name: string, description: string, parameters: array<string, mixed>, server_id: int}>  $tools
     * @return array<int, array{type: string, function: array{name: string, description: string, parameters: array<string, mixed>}}>
     */
    public function toOllamaTools(array $tools): array
    {
        return array_map(fn (array $tool) => [
            'type' => 'function',
            'function' => [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'parameters' => $tool['parameters'],
            ],
        ], $tools);
    }
}
