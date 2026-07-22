<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\PullModelRequest;
use App\Jobs\PullOllamaModel;
use App\Services\OllamaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ModelController extends Controller
{
    public function __construct(
        private readonly OllamaService $ollama,
    ) {}

    public function index(): JsonResponse
    {
        try {
            $response = $this->ollama->listModels();
            $models = collect($response['models'] ?? [])->pluck('name')->values();

            return response()->json(['models' => $models]);
        } catch (\Exception) {
            return response()->json(['models' => []], 500);
        }
    }

    public function pull(PullModelRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $model = $validated['model'];
        $cacheKey = "model_pull:{$model}";

        $currentStatus = Cache::get($cacheKey);
        if ($currentStatus) {
            $data = json_decode($currentStatus, true);
            if (is_array($data) && ($data['status'] ?? '') === 'pulling') {
                return response()->json([
                    'status' => 'pulling',
                    'message' => 'Model wordt al gedownload.',
                ]);
            }
        }

        Cache::put($cacheKey, json_encode([
            'status' => 'pulling',
            'progress' => 0,
            'detail' => 'In wachtrij...',
        ]), now()->addMinutes(30));

        $activePulls = Cache::get('model_pulls_active', []);
        $activePulls[$model] = true;
        Cache::put('model_pulls_active', $activePulls, now()->addMinutes(30));

        PullOllamaModel::dispatch($model);

        return response()->json([
            'status' => 'pulling',
            'message' => 'Download gestart.',
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $model = $request->query('model');

        if (! $model) {
            return response()->json(['status' => 'unknown'], 422);
        }

        $cacheKey = "model_pull:{$model}";
        $value = Cache::get($cacheKey);

        if ($value === null) {
            return response()->json(['status' => 'idle']);
        }

        $data = json_decode($value, true);

        if (! is_array($data)) {
            return response()->json(['status' => 'idle']);
        }

        return response()->json($data);
    }
}
