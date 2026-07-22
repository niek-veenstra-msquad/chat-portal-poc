<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\McpServer;
use Inertia\Inertia;
use Inertia\Response;

class McpServerController extends Controller
{
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
        ]);
    }
}
