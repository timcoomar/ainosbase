<div class="relative">
    <input wire:model="q" id="search" name="search" placeholder="Search" type="search">

    @if ($q)
        <div class="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
            <div class="py-1 text-sm text-gray-700">
                @forelse($results as $result)
                    <a href="{{ $result['url'] }}" class="block px-4 py-2 hover:bg-gray-100 hover:text-gray-900">{{ $result['title'] }}</a>
                @empty
                    <div class="block px-4 py-2">No results found</div>
                @endforelse
            </div>
        </div>
    @endif
</div>
