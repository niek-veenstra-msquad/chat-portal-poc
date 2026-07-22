<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'type', 'url', 'command', 'args', 'env', 'description', 'is_active'])]
class McpServer extends Model
{
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'env' => 'array',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isHttp(): bool
    {
        return $this->type === 'http';
    }

    public function isStdio(): bool
    {
        return $this->type === 'stdio';
    }
}
