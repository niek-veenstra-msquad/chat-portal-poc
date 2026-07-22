<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreMcpServerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:http,stdio'],
            'url' => ['nullable', 'required_if:type,http', 'url', 'max:500'],
            'command' => ['nullable', 'required_if:type,stdio', 'string', 'max:500'],
            'args' => ['nullable', 'string', 'max:1000'],
            'env' => ['nullable', 'array'],
            'env.*.key' => ['required', 'string', 'max:255'],
            'env.*.value' => ['required', 'string', 'max:1000'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
