<?php

namespace App\Services;

use App\Models\McpServer;
use Illuminate\Support\Facades\Log;
use Mcp\Client;
use Mcp\Client\Transport\HttpTransport;
use Mcp\Client\Transport\StdioTransport;
use Mcp\Schema\Content\TextContent;

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
                $client = $this->createClient();
                $transport = $this->createTransport($server);
                $client->connect($transport);

                $result = $client->listTools();

                foreach ($result->tools as $tool) {
                    $tools[] = [
                        'name' => $tool->name,
                        'description' => $tool->description ?? '',
                        'parameters' => $tool->inputSchema,
                        'server_id' => $server->id,
                    ];
                }

                $client->disconnect();
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
                $client = $this->createClient();
                $transport = $this->createTransport($server);
                $client->connect($transport);

                $toolsList = $client->listTools();
                $toolExists = false;

                foreach ($toolsList->tools as $tool) {
                    if ($tool->name === $toolName) {
                        $toolExists = true;
                        break;
                    }
                }

                if (! $toolExists) {
                    $client->disconnect();
                    continue;
                }

                $result = $client->callTool($toolName, $arguments);
                $client->disconnect();

                if ($result->isError) {
                    $errorText = collect($result->content)
                        ->filter(fn ($c) => $c instanceof TextContent)
                        ->map(fn (TextContent $c) => $c->text)
                        ->implode("\n");

                    return ['error' => $errorText ?: 'Tool execution failed'];
                }

                $textParts = collect($result->content)
                    ->filter(fn ($c) => $c instanceof TextContent)
                    ->map(fn (TextContent $c) => $c->text)
                    ->implode("\n");

                return ['result' => $textParts ?: json_encode($result->content)];
            } catch (\Exception $e) {
                Log::warning("Failed to call tool [{$toolName}] on MCP server [{$server->name}]: {$e->getMessage()}");
            }
        }

        return ['error' => "Tool '{$toolName}' not found on any active MCP server."];
    }

    private function createClient(): Client
    {
        return Client::builder()
            ->setClientInfo('chat-portal', '1.0.0')
            ->setInitTimeout(15)
            ->setRequestTimeout(30)
            ->build();
    }

    private function createTransport(McpServer $server): HttpTransport|StdioTransport
    {
        if ($server->isStdio()) {
            $parts = explode(' ', $server->command, 2);
            $command = $parts[0];
            $args = isset($parts[1]) ? explode(' ', $parts[1]) : [];

            return new StdioTransport(
                command: $command,
                args: $args,
                env: $server->env,
            );
        }

        return new HttpTransport(
            endpoint: $server->url,
        );
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
                'parameters' => ! empty($tool['parameters']) && is_array($tool['parameters']) && ! array_is_list($tool['parameters'])
                    ? $tool['parameters']
                    : ['type' => 'object', 'properties' => new \stdClass],
            ],
        ], $tools);
    }
}
