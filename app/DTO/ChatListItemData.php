<?php

namespace App\DTO;

use App\Models\Chat;

final class ChatListItemData
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly bool $pinned,
    ) {}

    public static function fromModel(Chat $chat): self
    {
        return new self(
            id: $chat->id,
            title: $chat->title,
            pinned: $chat->pinned_at !== null,
        );
    }
}
