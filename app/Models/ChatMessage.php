<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['chat_id', 'role', 'content'])]
class ChatMessage extends Model
{
    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }
}
