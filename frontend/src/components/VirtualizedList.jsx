import React, { useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * VirtualizedList - Efficiently renders large lists
 * Only renders visible items plus overscan
 * 
 * @param {Array} items - Array of items to render
 * @param {Function} renderItem - Function to render each item (item, index) => React.Node
 * @param {number} itemHeight - Height of each item in pixels (required for estimation)
 * @param {number} overscan - Number of items to render above/below visible area
 * @param {string} className - Container className
 * @param {Object} style - Container style
 * @param {Function} getItemKey - Function to get unique key for each item
 * @param {Function} onEndReached - Callback when scrolling near end
 * @param {number} endReachedThreshold - How many items from end to trigger onEndReached
 */
const VirtualizedList = ({
    items,
    renderItem,
    itemHeight = 50,
    overscan = 5,
    className = '',
    style = {},
    getItemKey,
    onEndReached,
    endReachedThreshold = 10,
}) => {
    const parentRef = useRef(null);
    const endReachedCalledRef = useRef(false);

    // Create virtualizer
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => itemHeight,
        overscan,
        getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined,
    });

    const virtualItems = virtualizer.getVirtualItems();

    // Handle end reached
    useEffect(() => {
        if (!onEndReached || items.length === 0) return;

        const lastItem = virtualItems[virtualItems.length - 1];
        if (!lastItem) return;

        const isNearEnd = lastItem.index >= items.length - endReachedThreshold;

        if (isNearEnd && !endReachedCalledRef.current) {
            endReachedCalledRef.current = true;
            onEndReached();
        } else if (!isNearEnd) {
            endReachedCalledRef.current = false;
        }
    }, [virtualItems, items.length, onEndReached, endReachedThreshold]);

    // Reset end reached when items change
    useEffect(() => {
        endReachedCalledRef.current = false;
    }, [items.length]);

    if (items.length === 0) {
        return null;
    }

    return (
        <div
            ref={parentRef}
            className={className}
            style={{
                overflow: 'auto',
                ...style,
            }}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualItems.map((virtualItem) => (
                    <div
                        key={virtualItem.key}
                        data-index={virtualItem.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                        }}
                    >
                        {renderItem(items[virtualItem.index], virtualItem.index)}
                    </div>
                ))}
            </div>
        </div>
    );
};

/**
 * VirtualizedGrid - Efficiently renders large grids
 * 
 * @param {Array} items - Array of items to render
 * @param {Function} renderItem - Function to render each item
 * @param {number} columnCount - Number of columns
 * @param {number} rowHeight - Height of each row
 * @param {number} columnWidth - Width of each column (or 'auto' for equal distribution)
 * @param {number} gap - Gap between items
 */
const VirtualizedGrid = ({
    items,
    renderItem,
    columnCount = 3,
    rowHeight = 100,
    columnWidth = 'auto',
    gap = 8,
    className = '',
    style = {},
    overscan = 3,
}) => {
    const parentRef = useRef(null);

    // Calculate rows
    const rowCount = Math.ceil(items.length / columnCount);

    const rowVirtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight + gap,
        overscan,
    });

    const virtualRows = rowVirtualizer.getVirtualItems();

    return (
        <div
            ref={parentRef}
            className={className}
            style={{
                overflow: 'auto',
                ...style,
            }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {virtualRows.map((virtualRow) => {
                    const startIndex = virtualRow.index * columnCount;
                    const rowItems = items.slice(startIndex, startIndex + columnCount);

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${rowHeight}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                                display: 'grid',
                                gridTemplateColumns: columnWidth === 'auto'
                                    ? `repeat(${columnCount}, 1fr)`
                                    : `repeat(${columnCount}, ${columnWidth}px)`,
                                gap: `${gap}px`,
                            }}
                        >
                            {rowItems.map((item, colIndex) => (
                                <div key={startIndex + colIndex}>
                                    {renderItem(item, startIndex + colIndex)}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * InfiniteList - VirtualizedList with infinite scroll
 * Automatically loads more items when near the end
 */
const InfiniteList = ({
    items,
    renderItem,
    itemHeight = 50,
    hasMore = false,
    isLoading = false,
    loadMore,
    loadingComponent = <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>,
    endComponent = null,
    ...props
}) => {
    const handleEndReached = () => {
        if (hasMore && !isLoading && loadMore) {
            loadMore();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <VirtualizedList
                items={items}
                renderItem={renderItem}
                itemHeight={itemHeight}
                onEndReached={handleEndReached}
                {...props}
            />
            {isLoading && loadingComponent}
            {!hasMore && !isLoading && items.length > 0 && endComponent}
        </div>
    );
};

/**
 * LazyImage - Image component with lazy loading
 */
const LazyImage = ({ src, alt, className, style, placeholder }) => {
    const imgRef = useRef(null);
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [isInView, setIsInView] = React.useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={imgRef} className={className} style={style}>
            {isInView ? (
                <img
                    src={src}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    style={{
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : placeholder || (
                <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#1e1e1e',
                }} />
            )}
        </div>
    );
};

export { VirtualizedList, VirtualizedGrid, InfiniteList, LazyImage };
export default VirtualizedList;
