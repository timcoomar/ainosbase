<div class="relative">
    <input wire:model="q" id="search" name="search" class="block w-full bg-gray-300 border border-transparent rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:bg-white focus:border-white focus:ring-white focus:text-gray-900 focus:placeholder-gray-500 sm:text-sm" placeholder="Search" type="search">

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
