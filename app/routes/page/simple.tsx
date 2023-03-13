import type { LinksFunction, LoaderArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useFetcher, useLoaderData, useTransition } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVirtual } from 'react-virtual';
import { useVirtualizer } from '@tanstack/react-virtual';

import { countItems, getItemsPaginated } from '~/utils/backend.server';
import stylesUrl from '~/styles/index.css';

export const links: LinksFunction = () => {
  return [{ rel: 'stylesheet', href: stylesUrl }];
};

const LIMIT = 200;
const DATA_OVERSCAN = 40;

const getPage = (searchParams: URLSearchParams) => ({
  page: Number(searchParams.get('page') || '0'),
});

export const loader = async ({ request }: LoaderArgs) => {
  const { page } = getPage(new URL(request.url).searchParams);
  return json(
    {
      items: await getItemsPaginated({ page, limit: LIMIT }),
      totalItems: await countItems(),
    },
    { headers: { 'Cache-Control': 'public, max-age=120' } }
  );
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [items, setItems] = useState(data.items);

  const transition = useTransition();
  const fetcher = useFetcher();
  const startRef = useRef(0);
  const page = useRef(0);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 75, []),
    overscan: 12,
    initialRect: { width: 0, height: 800 },
    lanes: 4,
  });

  const [lastVirtualItem] = [...rowVirtualizer.getVirtualItems()].reverse();
  if (!lastVirtualItem) {
    throw new Error('this should never happen');
  }

  let newStart = startRef.current;
  const upperBoundary = startRef.current + LIMIT - DATA_OVERSCAN;

  if (lastVirtualItem.index > upperBoundary) {
    // user is scrolling down. Move the window down
    newStart = startRef.current + LIMIT;
  }

  useEffect(() => {
    if (newStart === startRef.current) return;

    startRef.current = newStart;
    page.current += 1;

    fetcher.load(`/page/simple?page=${page.current}`);
  }, [page, newStart, fetcher]);

  useEffect(() => {
    if (fetcher.data) {
      setItems((prevItems: any) => [...prevItems, ...fetcher.data.items]);
    }
  }, [fetcher.data]);

  return (
    <main>
      <h1>
        Simple Infinite Scrolling (pages loaded {page.current + 1}/
        {data.totalItems / LIMIT})
      </h1>

      <div
        ref={parentRef}
        className="List"
        style={{
          height: `800px`,
          width: `100%`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            const prc = (virtualRow.index % 4) * 25;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  border: '2px solid green',
                  top: 0,
                  left: `${prc}%`,
                  width: '25%',
                  height: `75px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  padding: 5,
                }}
              >
                <span>{virtualRow.lane}</span>
                <span>
                  {item
                    ? item.value
                    : transition.state === 'loading'
                    ? 'Loading more...'
                    : 'Nothing to see here...'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
