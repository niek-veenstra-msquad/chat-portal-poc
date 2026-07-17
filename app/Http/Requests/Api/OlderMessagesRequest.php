<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class OlderMessagesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->route('chat')->user_id === $this->user()->id;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'before' => ['required', 'integer', 'min:1'],
        ];
    }
}
