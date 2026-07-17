<?php

namespace App\DTO;

use App\Models\Chat;

final class ChatData
{
    public function __construct(
        public readonly int $id,
        public readonly string $title,
        public readonly string $model,
    ) {}

    public static function fromModel(Chat $chat): self
    {
        return new self(
            id: $chat->id,
            title: $chat->title,
            model: $chat->model,
        );
    }
}
