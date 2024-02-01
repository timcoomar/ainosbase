<?php

namespace App\Livewire;

use Jonassiewertsen\LiveSearch\Http\Livewire\Search;

class Livesearch extends Search
{
    public $template;
    public $index;

    public function mount(string $template, string $index = null)
    {
        // You can pass these as parameters or they can be hardcoded.
        $this->template = $template;
        $this->index = $index;
    }

    public function render()
    {
        // Do your stuff here.

        return view($this->template, [
            'results' => $this->search($this->q, $this->index),
        ]);
    }
}
