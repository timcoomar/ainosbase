<?php

namespace App\Livewire;

use Livewire\Component;
use Statamic\Facades\Entry;

class PresenterBuilder extends Component
{
    public string $q = '';
    public array $setlist = [];
    public string $language = 'greek';

    public function addHymn(string $slug): void
    {
        foreach ($this->setlist as $item) {
            if ($item['slug'] === $slug) return;
        }

        $entry = Entry::query()
            ->where('collection', 'hymns')
            ->where('slug', $slug)
            ->first();

        if ($entry) {
            $this->setlist[] = [
                'slug'  => $slug,
                'title' => $entry->get('title'),
            ];
        }
    }

    public function removeHymn(int $pos): void
    {
        array_splice($this->setlist, $pos, 1);
        $this->setlist = array_values($this->setlist);
    }

    public function moveUp(int $pos): void
    {
        if ($pos === 0) return;
        [$this->setlist[$pos - 1], $this->setlist[$pos]] = [$this->setlist[$pos], $this->setlist[$pos - 1]];
    }

    public function moveDown(int $pos): void
    {
        if ($pos >= count($this->setlist) - 1) return;
        [$this->setlist[$pos], $this->setlist[$pos + 1]] = [$this->setlist[$pos + 1], $this->setlist[$pos]];
    }

    public function render()
    {
        $q           = mb_strtolower(trim($this->q));
        $setlistSlugs = array_column($this->setlist, 'slug');

        $results = [];
        if (strlen($q) >= 2) {
            $results = Entry::query()
                ->where('collection', 'hymns')
                ->get()
                ->filter(fn($e) =>
                    str_contains(mb_strtolower($e->get('title', '')), $q) ||
                    str_contains(mb_strtolower($e->get('greek_lyrics', '')), $q)
                )
                ->take(8)
                ->map(fn($e) => [
                    'slug'         => $e->slug(),
                    'title'        => $e->get('title'),
                    'already_added' => in_array($e->slug(), $setlistSlugs),
                ])
                ->values()
                ->all();
        }

        $total = count($this->setlist);
        $setlistIndexed = array_map(
            fn($item, $i) => array_merge($item, [
                'pos'      => $i,
                'number'   => $i + 1,
                'is_first' => $i === 0,
                'is_last'  => $i === $total - 1,
            ]),
            $this->setlist,
            array_keys($this->setlist)
        );

        $payload = base64_encode(json_encode([
            'hymns' => array_values($this->setlist),
            'lang'  => $this->language,
        ]));

        return view('livewire.presenter-builder', [
            'results'         => $results,
            'setlist_indexed' => $setlistIndexed,
            'launch_url'      => url('/presenter/present') . '#' . $payload,
        ]);
    }
}
