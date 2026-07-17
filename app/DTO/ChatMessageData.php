<?php

namespace App\DTO;

use App\Models\ChatMessage;

final class ChatMessageData
{
    public function __construct(
        public readonly int $id,
        public readonly string $role,
        public readonly string $content,
        public readonly string $created_at,
    ) {}

    public static function fromModel(ChatMessage $message): self
    {
        return new self(
            id: $message->id,
            role: $message->role,
            content: $message->content,
            created_at: $message->created_at->toISOString(),
        );
    }
}
